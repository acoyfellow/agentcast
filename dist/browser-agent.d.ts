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
import type { SessionStatus } from './types.js';
export interface SessionState {
    id: string;
    name?: string;
    status: SessionStatus;
    viewUrl: string;
    cdpUrl: string;
    wsEndpoint?: string;
    createdAt: number;
    lastActivity: number;
    viewport: {
        width: number;
        height: number;
    };
    colorScheme?: 'light' | 'dark';
    error?: string;
}
/**
 * Abstract class that extends Agent with browser automation capabilities
 */
export declare abstract class BrowserAgent extends Agent {
    protected _session: SessionState | null;
    protected _workerUrl: string;
    private _confirmationPromise;
    /**
     * Get the container namespace - must be implemented by subclasses
     */
    protected abstract getContainer(): DurableObjectNamespace<any>;
    /**
     * Get session ID from agent name
     * Only accessed in methods, not during initialization
     */
    private get sessionId();
    /**
     * Get view URL for the session
     */
    get viewUrl(): string;
    /**
     * Get CDP WebSocket URL for the session
     */
    get cdpUrl(): string;
    /**
     * Get current session status
     */
    get status(): SessionStatus;
    /**
     * Initialize browser session
     *
     * MUST actually start the browser - no fake sessions.
     * Waits for browser to be ready before returning.
     *
     * @throws {ContainerStartError} If browser fails to start
     */
    initialize(options: {
        sessionId: string;
        name?: string;
        viewport?: {
            width: number;
            height: number;
        };
        startUrl?: string;
        workerUrl?: string;
        colorScheme?: 'light' | 'dark';
    }): Promise<void>;
    /**
     * Ensure browser is initialized before use
     * Auto-initializes if not ready (similar to with-browser.ts)
     */
    private ensureInitialized;
    /**
     * Navigate browser to URL
     */
    goto(url: string): Promise<void>;
    /**
     * Send an instruction to the browser
     */
    act(instruction: string): Promise<void>;
    /**
     * Extract structured data from the current page
     */
    extract<T>(schema: z.ZodSchema<T>): Promise<T>;
    /**
     * Resize browser viewport
     */
    resize(viewport: {
        width: number;
        height: number;
    }): Promise<void>;
    /**
     * Reload browser page
     */
    reload(): Promise<void>;
    /**
     * Stop the browser session
     */
    stop(): Promise<void>;
    /**
     * Pause and wait for human confirmation
     */
    confirm(prompt: string, options?: {
        timeout?: number;
    }): Promise<boolean>;
    /**
     * Resolve a pending confirmation
     */
    resolveConfirmation(value: boolean): void;
    /**
     * Take a screenshot
     *
     * @deprecated Screenshot functionality not yet implemented
     * @throws {ScreenshotError} Always throws - not implemented
     */
    screenshot(): Promise<Buffer>;
}
//# sourceMappingURL=browser-agent.d.ts.map