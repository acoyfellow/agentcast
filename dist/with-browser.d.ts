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
import type { z } from 'zod';
import type { SessionStatus } from './types.js';
export interface BrowserCapable {
    readonly viewUrl: string;
    readonly cdpUrl: string;
    readonly status: SessionStatus;
    act(instruction: string): Promise<void>;
    confirm(prompt: string): Promise<boolean>;
    screenshot(): Promise<Buffer>;
    goto(url: string): Promise<void>;
    extract<T>(schema: z.ZodSchema<T>): Promise<T>;
}
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
}
/**
 * Mixin function that adds browser capabilities to Agent or DurableObject
 */
export declare function withBrowser<T extends abstract new (...args: any[]) => any>(Base: T): T;
//# sourceMappingURL=with-browser.d.ts.map