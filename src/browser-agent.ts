

import { Agent } from 'agents';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import type { z } from 'zod';
import * as Effect from 'effect/Effect';
import {
  startBrowser,
  stopBrowser,
  getContainerStatus,
  sendInstruction,
  resizeBrowser,
  reloadBrowser,
  navigateBrowser,
  extractData,
} from './browser.js';
import {
  BrowserError,
  NavigationError,
  ScreenshotError,
  SessionNotConnectedError,
  ContainerStartError,
} from './errors.js';
import type { SessionStatus } from './types.js';
import { DEFAULTS, getWorkerUrl } from './constants.js';

export interface SessionState {
  id: string;
  name?: string;
  status: SessionStatus;
  viewUrl: string;
  cdpUrl: string;
  wsEndpoint?: string;
  createdAt: number;
  lastActivity: number;
  viewport: { width: number; height: number };
  colorScheme?: 'light' | 'dark';
  error?: string; // Error message if status is 'error'
  currentUrl?: string;
  currentUrlObservedAt?: number;
}


export abstract class BrowserAgent extends Agent {
  protected _session: SessionState | null = null;
  protected _workerUrl: string = '';
  private _confirmationPromise: { resolve: (value: boolean) => void; reject: (error: Error) => void } | null = null;

  
  protected abstract getContainer(): DurableObjectNamespace<any>;

  protected getRecoveryInitializeOptions(): {
    gatewayUrl?: string;
    internalAiCredential?: string;
  } {
    return {};
  }

  
  private get sessionId(): string {
    return this.name;
  }

  
  get viewUrl(): string {
    return this._session?.viewUrl ?? '';
  }

  
  get cdpUrl(): string {
    return this._session?.cdpUrl ?? '';
  }

  
  get status(): SessionStatus {
    return this._session?.status ?? 'stopped';
  }

  
  async initialize(options: {
    sessionId: string;
    name?: string;
    viewport?: { width: number; height: number };
    startUrl?: string;
    workerUrl?: string;
    colorScheme?: 'light' | 'dark';
    gatewayUrl?: string;
    internalAiCredential?: string;
    diagnostic?: boolean;
    fingerprint?: { userAgent?: string; platform?: string; languages?: string[] };
  }): Promise<void> {
    const sessionId = options.sessionId;
    const baseUrl = options.workerUrl || this._workerUrl || getWorkerUrl();
    this._workerUrl = baseUrl;

    console.log(`[BrowserAgent.initialize] Starting initialization for: ${sessionId}`, {
      name: options.name,
      viewport: options.viewport,
      startUrl: options.startUrl,
      workerUrl: baseUrl,
      colorScheme: options.colorScheme,
    });

    this._session = {
      id: sessionId,
      name: options.name,
      status: 'starting',
      viewUrl: `${baseUrl}/view/${sessionId}`,
      cdpUrl: `${baseUrl.replace('http', 'ws')}/cdp/${sessionId}`,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      viewport: options.viewport ?? { width: 1280, height: 720 },
      colorScheme: options.colorScheme ?? 'dark',
    };

    const startTime = Date.now();
    try {
      console.log(`[BrowserAgent.initialize] Calling startBrowser for: ${sessionId}`);
      const data = await Effect.runPromise(
        startBrowser(this.getContainer(), sessionId, {
          viewport: this._session.viewport,
          startUrl: options.startUrl,
          colorScheme: this._session.colorScheme,
          gatewayUrl: options.gatewayUrl || `${baseUrl}/openai/v1`,
          internalAiCredential: options.internalAiCredential,
          diagnostic: options.diagnostic,
          fingerprint: options.fingerprint,
        })
      );

      const elapsed = Date.now() - startTime;
      console.log(`[BrowserAgent.initialize] Browser started successfully for ${sessionId} in ${elapsed}ms`, data);

      if (this._session) {
        this._session.status = 'ready';
        this._session.wsEndpoint = data.wsEndpoint;
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`[BrowserAgent.initialize] Browser start failed for ${sessionId} after ${elapsed}ms:`, error);

      if (this._session) {
        this._session.status = 'error';
        this._session.error = error instanceof Error ? error.message : String(error);
      }

      if (error instanceof ContainerStartError) {
        throw error;
      }

      throw new ContainerStartError({
        message: error instanceof Error ? error.message : String(error),
        sessionId,
        cause: error,
      });
    }
  }

  private async ensureLiveContainer(): Promise<void> {
    if (!this._session) return;
    try {
      const status = await Effect.runPromise(
        getContainerStatus(this.getContainer(), this._session.id),
      );
      if (status.running) return;
    } catch {
    }
    this._session.status = 'starting';
    await this.initialize({
      sessionId: this._session.id,
      name: this._session.name,
      viewport: this._session.viewport,
      workerUrl: this._workerUrl,
      colorScheme: this._session.colorScheme,
      ...this.getRecoveryInitializeOptions(),
    });
  }

  
  private async ensureInitialized(): Promise<void> {
    if (this._session?.status === 'ready') {
      return;
    }

    const sessionId = this._session?.id ?? this.sessionId;

    if (this._session?.status === 'error') {
      throw new SessionNotConnectedError({
        message: this._session.error ?? 'Browser initialization failed',
        sessionId,
      });
    }

    const currentStatus = this._session?.status;
    if (currentStatus === 'starting') {
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait
      while (this._session?.status === 'starting' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      const finalStatus = this._session?.status as SessionStatus | undefined;
      if (finalStatus === 'ready') {
        return;
      }
      if (finalStatus === 'error') {
        throw new SessionNotConnectedError({
          message: this._session?.error ?? 'Browser initialization failed',
          sessionId,
        });
      }
      throw new SessionNotConnectedError({
        message: 'Browser initialization timeout',
        sessionId,
      });
    }

    if (!this._session || this._session.status === 'stopped') {
      const workerUrl = this._workerUrl || getWorkerUrl();
      const viewport = this._session?.viewport ?? { width: 1280, height: 720 };
      const colorScheme = this._session?.colorScheme ?? 'dark';
      const name = this._session?.name ?? sessionId;

      await this.initialize({
        sessionId,
        name,
        viewport,
        workerUrl,
        colorScheme,
        ...this.getRecoveryInitializeOptions(),
      });

      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        const status = this._session?.status as SessionStatus | undefined;
        if (status === 'ready') {
          return;
        }
        if (status === 'error') {
          throw new SessionNotConnectedError({
            message: this._session?.error ?? 'Browser initialization failed',
            sessionId,
          });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }

      const finalStatus = this._session?.status as SessionStatus | undefined;
      if (finalStatus !== 'ready') {
        throw new SessionNotConnectedError({
          message: 'Browser initialization timeout',
          sessionId,
        });
      }
      return;
    }

    throw new SessionNotConnectedError({
      message: 'Browser not initialized or not ready',
      sessionId,
    });
  }

  
  async goto(url: string): Promise<void> {
    await this.ensureInitialized();

    await Effect.runPromise(
      navigateBrowser(this.getContainer(), this._session!.id, url)
    );

    this._session!.lastActivity = Date.now();
  }

  
  async act(instruction: string): Promise<{ success: boolean; response?: string }> {
    await this.ensureInitialized();
    await this.ensureLiveContainer();

    const result = await Effect.runPromise(
      sendInstruction(this.getContainer(), this._session!.id, instruction)
    );

    this._session!.lastActivity = Date.now();
    return result;
  }

  
  async waitForReady(timeoutMs: number = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this._session?.status === 'ready') {
        return;
      }
      if (this._session?.status === 'error') {
        throw new SessionNotConnectedError({
          message: this._session.error ?? 'Browser initialization failed',
          sessionId: this._session.id,
        });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new SessionNotConnectedError({
      message: `Timeout waiting for browser to be ready after ${timeoutMs}ms`,
      sessionId: this._session?.id ?? 'unknown',
    });
  }

  
  async extract<T>(schema: z.ZodSchema<T>): Promise<T> {
    await this.ensureInitialized();

    const result = await Effect.runPromise(
      extractData(this.getContainer(), this._session!.id, schema)
    );

    this._session!.lastActivity = Date.now();
    return result;
  }

  
  async resize(viewport: { width: number; height: number }): Promise<void> {
    await this.ensureInitialized();

    await Effect.runPromise(
      resizeBrowser(this.getContainer(), this._session!.id, viewport)
    );

    this._session!.viewport = viewport;
    this._session!.lastActivity = Date.now();
  }

  
  async reload(): Promise<void> {
    await this.ensureInitialized();

    await Effect.runPromise(
      reloadBrowser(this.getContainer(), this._session!.id)
    );

    this._session!.lastActivity = Date.now();
  }

  
  async stop(): Promise<void> {
    if (!this._session) {
      return;
    }

    this._session.status = 'stopping';

    try {
      await Effect.runPromise(
        stopBrowser(this.getContainer(), this._session.id)
      );
    } catch (error) {
      console.warn(`[BrowserAgent] Failed to stop browser: ${error instanceof Error ? error.message : String(error)}`);
    }

    this._session.status = 'stopped';
  }

  
  async confirm(prompt: string, options?: { timeout?: number }): Promise<boolean> {
    if (!this._session) {
      throw new SessionNotConnectedError({
        message: 'Session not initialized',
        sessionId: 'unknown',
      });
    }

    const timeoutMs = options?.timeout ?? DEFAULTS.CONFIRMATION_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      this._confirmationPromise = { resolve, reject };

      setTimeout(() => {
        if (this._confirmationPromise) {
          this._confirmationPromise.resolve(false);
          this._confirmationPromise = null;
        }
      }, timeoutMs);
    });
  }

  
  resolveConfirmation(value: boolean): void {
    if (this._confirmationPromise) {
      this._confirmationPromise.resolve(value);
      this._confirmationPromise = null;
    }
  }

  
  async screenshot(): Promise<Buffer> {
    throw new ScreenshotError({
      message: 'Screenshot functionality is not yet implemented. This will be available in a future release.',
    });
  }
}

