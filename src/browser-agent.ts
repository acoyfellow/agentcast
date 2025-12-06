/**
 * BrowserAgent - Abstract class for browser automation with Cloudflare Agents SDK
 * 
 * Extends Agent to provide browser capabilities without the recursion issues
 * of the withBrowser mixin pattern.
 * 
 * @example
 * ```typescript
 * import { BrowserAgent } from 'agentcast';
 * 
 * export class WebAgent extends BrowserAgent {
 *   protected getContainer() {
 *     return this.env.CONTAINER;
 *   }
 *   
 *   async run() {
 *     await this.goto('https://example.com');
 *     await this.act('click the login button');
 *   }
 * }
 * ```
 */

import { Agent } from 'agents';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import type { z } from 'zod';
import * as Effect from 'effect/Effect';
import {
  startBrowser,
  stopBrowser,
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
}

/**
 * Abstract class that extends Agent with browser automation capabilities
 */
export abstract class BrowserAgent extends Agent {
  protected _session: SessionState | null = null;
  protected _workerUrl: string = '';
  private _confirmationPromise: { resolve: (value: boolean) => void; reject: (error: Error) => void } | null = null;

  /**
   * Get the container namespace - must be implemented by subclasses
   */
  protected abstract getContainer(): DurableObjectNamespace<any>;

  /**
   * Get session ID from agent name
   * Only accessed in methods, not during initialization
   */
  private get sessionId(): string {
    return this.name;
  }

  /**
   * Get view URL for the session
   */
  get viewUrl(): string {
    return this._session?.viewUrl ?? '';
  }

  /**
   * Get CDP WebSocket URL for the session
   */
  get cdpUrl(): string {
    return this._session?.cdpUrl ?? '';
  }

  /**
   * Get current session status
   */
  get status(): SessionStatus {
    return this._session?.status ?? 'stopped';
  }

  /**
   * Initialize browser session
   * 
   * MUST actually start the browser - no fake sessions.
   * Waits for browser to be ready before returning.
   * 
   * @throws {ContainerStartError} If browser fails to start
   */
  async initialize(options: {
    sessionId: string;
    name?: string;
    viewport?: { width: number; height: number };
    startUrl?: string;
    workerUrl?: string;
    colorScheme?: 'light' | 'dark';
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

    // Set status to starting
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

    // Actually start the browser - wait for it to be ready
    const startTime = Date.now();
    try {
      console.log(`[BrowserAgent.initialize] Calling startBrowser for: ${sessionId}`);
      const data = await Effect.runPromise(
        startBrowser(this.getContainer(), sessionId, {
          viewport: this._session.viewport,
          startUrl: options.startUrl,
          colorScheme: this._session.colorScheme,
        })
      );

      const elapsed = Date.now() - startTime;
      console.log(`[BrowserAgent.initialize] Browser started successfully for ${sessionId} in ${elapsed}ms`, data);

      // Browser started successfully
      if (this._session) {
        this._session.status = 'ready';
        this._session.wsEndpoint = data.wsEndpoint;
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      console.error(`[BrowserAgent.initialize] Browser start failed for ${sessionId} after ${elapsed}ms:`, error);

      // Browser failed to start - set error status and throw
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

  /**
   * Ensure browser is initialized before use
   * Auto-initializes if not ready (similar to with-browser.ts)
   */
  private async ensureInitialized(): Promise<void> {
    // If already ready, we're good
    if (this._session?.status === 'ready') {
      return;
    }

    const sessionId = this._session?.id ?? this.sessionId;

    // If status is 'error', throw immediately
    if (this._session?.status === 'error') {
      throw new SessionNotConnectedError({
        message: this._session.error ?? 'Browser initialization failed',
        sessionId,
      });
    }

    // If status is 'starting', wait for it to become ready
    const currentStatus = this._session?.status;
    if (currentStatus === 'starting') {
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max wait
      while (this._session?.status === 'starting' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      // Check final status after waiting (status can change during async operations)
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

    // If not initialized or stopped, try to initialize
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
      });

      // Wait a bit for status to update (initialize() sets status to 'ready' when done)
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

      // Timeout - check final status
      const finalStatus = this._session?.status as SessionStatus | undefined;
      if (finalStatus !== 'ready') {
        throw new SessionNotConnectedError({
          message: 'Browser initialization timeout',
          sessionId,
        });
      }
      return;
    }

    // Fallback: throw if we somehow get here
    throw new SessionNotConnectedError({
      message: 'Browser not initialized or not ready',
      sessionId,
    });
  }

  /**
   * Navigate browser to URL
   */
  async goto(url: string): Promise<void> {
    await this.ensureInitialized();

    await Effect.runPromise(
      navigateBrowser(this.getContainer(), this._session!.id, url)
    );

    this._session!.lastActivity = Date.now();
  }

  /**
   * Send an instruction to the browser
   */
  async act(instruction: string): Promise<void> {
    await this.ensureInitialized();

    await Effect.runPromise(
      sendInstruction(this.getContainer(), this._session!.id, instruction)
    );

    this._session!.lastActivity = Date.now();
  }

  /**
   * Extract structured data from the current page
   */
  async extract<T>(schema: z.ZodSchema<T>): Promise<T> {
    await this.ensureInitialized();

    const result = await Effect.runPromise(
      extractData(this.getContainer(), this._session!.id, schema)
    );

    this._session!.lastActivity = Date.now();
    return result;
  }

  /**
   * Resize browser viewport
   */
  async resize(viewport: { width: number; height: number }): Promise<void> {
    await this.ensureInitialized();

    await Effect.runPromise(
      resizeBrowser(this.getContainer(), this._session!.id, viewport)
    );

    this._session!.viewport = viewport;
    this._session!.lastActivity = Date.now();
  }

  /**
   * Reload browser page
   */
  async reload(): Promise<void> {
    await this.ensureInitialized();

    await Effect.runPromise(
      reloadBrowser(this.getContainer(), this._session!.id)
    );

    this._session!.lastActivity = Date.now();
  }

  /**
   * Stop the browser session
   */
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
      // Log but don't throw - container may already be stopped
      console.warn(`[BrowserAgent] Failed to stop browser: ${error instanceof Error ? error.message : String(error)}`);
    }

    this._session.status = 'stopped';
  }

  /**
   * Pause and wait for human confirmation
   */
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

  /**
   * Resolve a pending confirmation
   */
  resolveConfirmation(value: boolean): void {
    if (this._confirmationPromise) {
      this._confirmationPromise.resolve(value);
      this._confirmationPromise = null;
    }
  }

  /**
   * Take a screenshot
   * 
   * @deprecated Screenshot functionality not yet implemented
   * @throws {ScreenshotError} Always throws - not implemented
   */
  async screenshot(): Promise<Buffer> {
    throw new ScreenshotError({
      message: 'Screenshot functionality is not yet implemented. This will be available in a future release.',
    });
  }
}

