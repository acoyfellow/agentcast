/**
 * @deprecated This mixin causes recursion issues with Cloudflare Agents SDK.
 * Use `BrowserAgent` class instead: `import { BrowserAgent } from 'agentcast'`
 *
 * Migration:
 * ```typescript
 * // OLD
 * export class WebAgent extends withBrowser(Agent) { }
 *
 * // NEW
 * export class WebAgent extends BrowserAgent {
 *   protected getContainer() {
 *     return this.env.CONTAINER;
 *   }
 * }
 * ```
 *
 * withBrowser mixin
 *
 * Adds browser capabilities to Agent or DurableObject classes.
 *
 * @example With Agent (DEPRECATED)
 * ```typescript
 * import { Agent } from 'agents';
 * import { withBrowser } from 'agentcast';
 * import { z } from 'zod';
 *
 * export class WebAgent extends withBrowser(Agent) {
 *   async run() {
 *     await this.goto('https://example.com');
 *     await this.act('click the login button');
 *     const data = await this.extract(z.object({ title: z.string() }));
 *     return { data, watch: this.cdpUrl };
 *   }
 * }
 * ```
 *
 * @example With DurableObject (DEPRECATED)
 * ```typescript
 * import { withBrowser } from "agentcast";
 * import { DurableObject } from "cloudflare:workers";
 *
 * export class MyAgent extends withBrowser(DurableObject) {
 *   async onRequest(request: Request) {
 *     await this.act("go to amazon");
 *     await this.confirm("Proceed?");
 *     return Response.json({ watch: this.viewUrl });
 *   }
 * }
 * ```
 */
import * as Effect from 'effect/Effect';
import { startBrowser, stopBrowser, sendInstruction, resizeBrowser, reloadBrowser, navigateBrowser, extractData, } from './browser.js';
import { ScreenshotError, SessionNotConnectedError, } from './errors.js';
import { DEFAULTS, getWorkerUrl } from './constants.js';
/**
 * Mixin function that adds browser capabilities to Agent or DurableObject
 */
export function withBrowser(Base) {
    class BrowserMixin extends Base {
        _session = null;
        _workerUrl = '';
        _confirmationPromise = null;
        _envCache = null; // Cache env to avoid recursion
        /**
         * Detect context type (Agent vs DurableObject) and return appropriate properties
         *
         * CRITICAL: This getter must NOT access this.name or this.env during initialization,
         * as that triggers getAgentByName()'s internal fetch calls, causing recursion.
         * Instead, it uses cached values and only accesses properties when safe.
         */
        get context() {
            const self = this;
            // Use cached env - never access self.env directly here to avoid recursion
            const envValue = this._envCache;
            if (!envValue) {
                // If env not cached yet, we can't determine context safely
                // This happens during getAgentByName() initialization
                // Return a safe default that won't trigger property access
                return {
                    type: 'agent',
                    env: {}, // Placeholder - will be set when env is cached
                    sessionId: 'unknown', // Will be set later when name is available
                    storage: null,
                };
            }
            // Check for DurableObject pattern first (doesn't require name)
            if (self.ctx) {
                return {
                    type: 'durable',
                    env: envValue,
                    sessionId: self.ctx.id.toString(),
                    storage: self.ctx.storage,
                };
            }
            // For Agent pattern, try to get name safely
            // Use Object.getOwnPropertyDescriptor to check if name exists without triggering getter
            let nameValue;
            try {
                const nameDesc = Object.getOwnPropertyDescriptor(self, 'name');
                if (nameDesc && nameDesc.value) {
                    nameValue = nameDesc.value;
                }
                else {
                    // Check if name is a getter - if so, don't call it during init
                    // Instead, we'll use the sessionId from _session if available
                    if (this._session?.id) {
                        nameValue = this._session.id;
                    }
                }
            }
            catch (err) {
                // If accessing name causes error, use session ID if available
                if (this._session?.id) {
                    nameValue = this._session.id;
                }
            }
            // Agent pattern: has env and (name or session ID)
            if (nameValue) {
                return {
                    type: 'agent',
                    env: envValue,
                    sessionId: nameValue,
                    storage: null,
                };
            }
            // Fallback: return context with unknown sessionId
            // This is safe during initialization
            return {
                type: 'agent',
                env: envValue,
                sessionId: 'unknown',
                storage: null,
            };
        }
        /**
         * Get environment bindings
         * FIX: Cache env value to avoid recursion during getServerByName() name setting
         */
        get env() {
            // If cached, return it immediately (avoids any property access)
            if (this._envCache) {
                return this._envCache;
            }
            // CRITICAL: Access env from Agent instance directly, without triggering any getters
            // that might call context or cause recursion
            const self = this;
            // Try to get env from the instance's own properties first
            let envValue;
            const ownDesc = Object.getOwnPropertyDescriptor(self, 'env');
            if (ownDesc) {
                // If it's a value property, use it directly
                if (ownDesc.value && typeof ownDesc.value === 'object' && 'CONTAINER' in ownDesc.value) {
                    envValue = ownDesc.value;
                }
                // If it's a getter, we need to be careful - but during initialization,
                // the Agent's env should be a regular property, not a getter
            }
            // If not found on instance, try from Agent prototype (skip BrowserMixin)
            if (!envValue) {
                const agentProto = Object.getPrototypeOf(Object.getPrototypeOf(this));
                const protoDesc = Object.getOwnPropertyDescriptor(agentProto, 'env');
                if (protoDesc && protoDesc.value && typeof protoDesc.value === 'object' && 'CONTAINER' in protoDesc.value) {
                    envValue = protoDesc.value;
                }
            }
            // Last resort: try bracket notation (avoids triggering getters in some cases)
            if (!envValue) {
                try {
                    const envProp = self['env'];
                    if (envProp && typeof envProp === 'object' && 'CONTAINER' in envProp) {
                        envValue = envProp;
                    }
                }
                catch (err) {
                    // If accessing causes error, we'll throw below
                }
            }
            if (!envValue) {
                throw new Error('withBrowser env not available. Ensure Agent has env binding with CONTAINER.');
            }
            // Cache it immediately to avoid future property access
            this._envCache = envValue;
            return this._envCache;
        }
        /**
         * Get DurableObject context (only available for DurableObject)
         */
        get ctx() {
            const ctx = this.context;
            if (ctx.type === 'durable') {
                const self = this;
                return self.ctx;
            }
            return null;
        }
        /**
         * Get worker URL from various sources
         */
        getWorkerUrl() {
            const self = this;
            // Try from request context (Agent may have access)
            if (self.request?.url) {
                const url = new URL(self.request.url);
                return `${url.protocol}//${url.host}`;
            }
            // Try from env
            if (self.env?.WORKER_URL) {
                return self.env.WORKER_URL;
            }
            // Use stored URL
            if (this._workerUrl) {
                return this._workerUrl;
            }
            // Fallback - pass env to getWorkerUrl so it can check WORKER_URL
            return getWorkerUrl(self.env);
        }
        /**
         * Auto-initialize browser session on first use
         */
        async ensureInitialized() {
            if (!this._session || this._session.status !== 'ready') {
                const ctx = this.context;
                await this.initialize({
                    sessionId: ctx.sessionId,
                    workerUrl: this.getWorkerUrl(),
                });
                // Wait for browser to be ready (poll status)
                let attempts = 0;
                const maxAttempts = 60; // 60 seconds max wait
                while (this._session?.status !== 'ready' && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    attempts++;
                    // Reload session state if using DurableObject
                    if (ctx.type === 'durable' && ctx.storage) {
                        this._session = await ctx.storage.get('session') ?? this._session;
                    }
                }
                if (this._session?.status !== 'ready') {
                    throw new SessionNotConnectedError({
                        message: 'Browser initialization timeout',
                        sessionId: ctx.sessionId,
                    });
                }
            }
        }
        get viewUrl() {
            return this._session?.viewUrl ?? '';
        }
        get cdpUrl() {
            return this._session?.cdpUrl ?? '';
        }
        get status() {
            return this._session?.status ?? 'stopped';
        }
        /**
         * Initialize browser session
         */
        async initialize(options) {
            const sessionId = options.sessionId;
            const { getWorkerUrl } = await import('./constants.js');
            const baseUrl = options.workerUrl || this._workerUrl || getWorkerUrl();
            this._workerUrl = baseUrl;
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
            // Save session state (only for DurableObject)
            const ctx = this.context;
            if (ctx.type === 'durable' && ctx.storage) {
                await ctx.storage.put('session', this._session);
            }
            // Start container asynchronously
            Effect.runPromise(startBrowser(this.env.CONTAINER, sessionId, {
                viewport: this._session.viewport,
                startUrl: options.startUrl,
                colorScheme: this._session.colorScheme,
            }))
                .then((data) => {
                if (this._session) {
                    this._session.status = 'ready';
                    this._session.wsEndpoint = data.wsEndpoint;
                    const ctx = this.context;
                    if (ctx.type === 'durable' && ctx.storage) {
                        ctx.storage.put('session', this._session);
                    }
                }
            })
                .catch((err) => {
                console.error('[withBrowser] Container start failed:', err);
                if (this._session) {
                    this._session.status = 'stopped';
                    const ctx = this.context;
                    if (ctx.type === 'durable' && ctx.storage) {
                        ctx.storage.put('session', this._session);
                    }
                }
            });
        }
        /**
         * Send an instruction to the browser
         */
        async act(instruction) {
            await this.ensureInitialized();
            await Effect.runPromise(sendInstruction(this.env.CONTAINER, this._session.id, instruction));
            this._session.lastActivity = Date.now();
            const ctx = this.context;
            if (ctx.type === 'durable' && ctx.storage) {
                await ctx.storage.put('session', this._session);
            }
        }
        /**
         * Pause and wait for human confirmation
         *
         * @param prompt - Message to display to user
         * @param options - Configuration options
         * @param options.timeout - Timeout in milliseconds (default: 60000)
         */
        async confirm(prompt, options) {
            if (!this._session) {
                throw new SessionNotConnectedError({
                    message: 'Session not initialized',
                    sessionId: 'unknown',
                });
            }
            const timeoutMs = options?.timeout ?? DEFAULTS.CONFIRMATION_TIMEOUT_MS;
            // Emit confirmation event (would be handled by viewer)
            // For now, return true after a timeout
            return new Promise((resolve, reject) => {
                this._confirmationPromise = { resolve, reject };
                // Timeout after specified duration
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
        resolveConfirmation(value) {
            if (this._confirmationPromise) {
                this._confirmationPromise.resolve(value);
                this._confirmationPromise = null;
            }
        }
        /**
         * Take a screenshot
         *
         * @deprecated Screenshot functionality not yet implemented.
         * This will be added in a future release via container API.
         *
         * @throws {ScreenshotError} Always throws - not implemented
         */
        async screenshot() {
            throw new ScreenshotError({
                message: 'Screenshot functionality is not yet implemented. This will be available in a future release.',
            });
        }
        /**
         * Navigate browser to URL
         */
        async goto(url) {
            await this.ensureInitialized();
            await Effect.runPromise(navigateBrowser(this.env.CONTAINER, this._session.id, url));
            this._session.lastActivity = Date.now();
            const ctx = this.context;
            if (ctx.type === 'durable' && ctx.storage) {
                await ctx.storage.put('session', this._session);
            }
        }
        /**
         * Extract structured data from the current page
         *
         * @param schema - Zod schema defining the data structure to extract
         * @returns Extracted data matching the schema
         * @example
         * const data = await this.extract(z.object({
         *   title: z.string(),
         *   price: z.number(),
         * }));
         */
        async extract(schema) {
            await this.ensureInitialized();
            const result = await Effect.runPromise(extractData(this.env.CONTAINER, this._session.id, schema));
            this._session.lastActivity = Date.now();
            const ctx = this.context;
            if (ctx.type === 'durable' && ctx.storage) {
                await ctx.storage.put('session', this._session);
            }
            return result;
        }
        /**
         * Stop the browser session
         */
        async stop() {
            if (!this._session)
                return;
            this._session.status = 'stopping';
            const ctx = this.context;
            if (ctx.type === 'durable' && ctx.storage) {
                await ctx.storage.put('session', this._session);
            }
            await Effect.runPromise(stopBrowser(this.env.CONTAINER, this._session.id)).catch(() => {
                // Best effort
            });
            this._session.status = 'stopped';
            if (ctx.type === 'durable' && ctx.storage) {
                await ctx.storage.put('session', this._session);
            }
        }
        /**
         * Resize browser viewport
         */
        async resize(viewport) {
            if (!this._session || this._session.status !== 'ready') {
                throw new SessionNotConnectedError({
                    message: 'Browser not ready',
                    sessionId: this._session?.id ?? 'unknown',
                });
            }
            await Effect.runPromise(resizeBrowser(this.env.CONTAINER, this._session.id, viewport));
            this._session.viewport = viewport;
            this._session.lastActivity = Date.now();
            const ctx = this.context;
            if (ctx.type === 'durable' && ctx.storage) {
                await ctx.storage.put('session', this._session);
            }
        }
        /**
         * Reload browser page
         */
        async reload() {
            await this.ensureInitialized();
            await Effect.runPromise(reloadBrowser(this.env.CONTAINER, this._session.id));
            this._session.lastActivity = Date.now();
            const ctx = this.context;
            if (ctx.type === 'durable' && ctx.storage) {
                await ctx.storage.put('session', this._session);
            }
        }
    }
    return BrowserMixin;
}
//# sourceMappingURL=with-browser.js.map