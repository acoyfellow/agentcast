/**
 * Effect-based container operations
 *
 * Handles all interaction with Cloudflare Containers using Effect for
 * retries, timeouts, and error handling.
 */
import * as Effect from 'effect/Effect';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import type { z } from 'zod';
import { ContainerStartError, BrowserError, NavigationError } from './errors.js';
import type { BrowserFingerprint } from './types.js';
export interface BrowserOptions {
    viewport?: {
        width: number;
        height: number;
    };
    startUrl?: string;
    colorScheme?: 'light' | 'dark';
    apiKey?: string;
    fingerprint?: BrowserFingerprint;
}
export interface ContainerResponse {
    success: boolean;
    wsEndpoint?: string;
    error?: string;
    browserReady?: boolean;
}
/**
 * Start a browser container
 */
export declare const startBrowser: (containerNamespace: DurableObjectNamespace<any>, sessionId: string, options: BrowserOptions) => Effect.Effect<ContainerResponse, ContainerStartError>;
/**
 * Stop a browser container
 *
 * Best-effort: logs errors but doesn't fail (container may already be stopped)
 */
export declare const stopBrowser: (containerNamespace: DurableObjectNamespace<any>, sessionId: string) => Effect.Effect<void, never>;
/**
 * Send an instruction to the container
 */
export declare const sendInstruction: (containerNamespace: DurableObjectNamespace<any>, sessionId: string, instruction: string) => Effect.Effect<{
    success: boolean;
    response?: string;
}, BrowserError>;
/**
 * Resize browser viewport
 */
export declare const resizeBrowser: (containerNamespace: DurableObjectNamespace<any>, sessionId: string, viewport: {
    width: number;
    height: number;
}) => Effect.Effect<void, BrowserError>;
/**
 * Reload browser page
 */
export declare const reloadBrowser: (containerNamespace: DurableObjectNamespace<any>, sessionId: string) => Effect.Effect<void, BrowserError>;
/**
 * Navigate browser to URL
 */
export declare const navigateBrowser: (containerNamespace: DurableObjectNamespace<any>, sessionId: string, url: string) => Effect.Effect<void, NavigationError>;
/**
 * Extract structured data from the current page
 */
export declare const extractData: <T>(containerNamespace: DurableObjectNamespace<any>, sessionId: string, schema: z.ZodSchema<T>) => Effect.Effect<T, BrowserError>;
//# sourceMappingURL=browser.d.ts.map