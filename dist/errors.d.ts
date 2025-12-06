/**
 * AgentCast Error Types
 *
 * Structured error types using Effect's Data.TaggedError for type-safe error handling.
 */
declare const ConnectionError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "ConnectionError";
} & Readonly<A>;
/**
 * Failed to connect to the AgentCast API
 */
export declare class ConnectionError extends ConnectionError_base<{
    readonly message: string;
    readonly url?: string;
    readonly cause?: unknown;
}> {
}
declare const TimeoutError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "TimeoutError";
} & Readonly<A>;
/**
 * Connection timed out
 */
export declare class TimeoutError extends TimeoutError_base<{
    readonly message: string;
    readonly duration: number;
    readonly operation: string;
}> {
}
declare const ApiError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "ApiError";
} & Readonly<A>;
/**
 * API returned an error response
 */
export declare class ApiError extends ApiError_base<{
    readonly message: string;
    readonly status: number;
    readonly body?: string;
}> {
}
declare const SessionNotFoundError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "SessionNotFoundError";
} & Readonly<A>;
/**
 * Session not found
 */
export declare class SessionNotFoundError extends SessionNotFoundError_base<{
    readonly message: string;
    readonly sessionId: string;
}> {
}
declare const SessionStoppedError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "SessionStoppedError";
} & Readonly<A>;
/**
 * Session already stopped
 */
export declare class SessionStoppedError extends SessionStoppedError_base<{
    readonly message: string;
    readonly sessionId: string;
}> {
}
declare const SessionNotConnectedError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "SessionNotConnectedError";
} & Readonly<A>;
/**
 * Session not connected (browser not ready)
 */
export declare class SessionNotConnectedError extends SessionNotConnectedError_base<{
    readonly message: string;
    readonly sessionId: string;
}> {
}
declare const BrowserError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "BrowserError";
} & Readonly<A>;
/**
 * Browser failed to launch or crashed
 */
export declare class BrowserError extends BrowserError_base<{
    readonly message: string;
    readonly cause?: unknown;
}> {
}
declare const NavigationError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "NavigationError";
} & Readonly<A>;
/**
 * Page navigation failed
 */
export declare class NavigationError extends NavigationError_base<{
    readonly message: string;
    readonly url: string;
    readonly cause?: unknown;
}> {
}
declare const ScreenshotError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "ScreenshotError";
} & Readonly<A>;
/**
 * Screenshot capture failed
 */
export declare class ScreenshotError extends ScreenshotError_base<{
    readonly message: string;
    readonly cause?: unknown;
}> {
}
declare const ContainerStartError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "ContainerStartError";
} & Readonly<A>;
/**
 * Container failed to start
 */
export declare class ContainerStartError extends ContainerStartError_base<{
    readonly message: string;
    readonly sessionId?: string;
    readonly cause?: unknown;
}> {
}
declare const ContainerCrashError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").Equals<A, {}> extends true ? void : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }) => import("effect/Cause").YieldableError & {
    readonly _tag: "ContainerCrashError";
} & Readonly<A>;
/**
 * Container crashed unexpectedly
 */
export declare class ContainerCrashError extends ContainerCrashError_base<{
    readonly message: string;
    readonly sessionId?: string;
}> {
}
/**
 * All connection-related errors
 */
export type ConnectionErrors = ConnectionError | TimeoutError | ApiError;
/**
 * All session-related errors
 */
export type SessionErrors = SessionNotFoundError | SessionStoppedError | SessionNotConnectedError;
/**
 * All browser-related errors
 */
export type BrowserErrors = BrowserError | NavigationError | ScreenshotError;
/**
 * All container-related errors
 */
export type ContainerErrors = ContainerStartError | ContainerCrashError;
/**
 * All AgentCast errors
 */
export type AgentCastError = ConnectionErrors | SessionErrors | BrowserErrors | ContainerErrors;
export {};
//# sourceMappingURL=errors.d.ts.map