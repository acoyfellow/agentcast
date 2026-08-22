/**
 * AgentCast - Client-safe exports
 * 
 * This entry point exports only constants, types, and errors that are safe
 * to use in any environment (browser, Node.js, Workers).
 * 
 * Use this for client applications (SvelteKit, React, etc.) that run in
 * non-Workers environments.
 * 
 * @example
 * ```typescript
 * import { CLIENT_STATUS, SERVER_STATUS, type SessionStatus } from 'agentcast/client';
 * ```
 */

// Export constants (safe for all environments)
export {
  UNIFIED_STATUS,
  SERVER_STATUS,
  CLIENT_STATUS,
  SESSION_STATUS,
  ERROR_CODES,
  DEFAULTS,
  getWorkerUrl,
  DEFAULT_WORKER_URL,
} from './constants.js';

// Export types (safe for all environments)
export type {
  SessionStatus,
  SessionInfo,
  SessionEventMap,
} from './types.js';

export type {
  BrowserCheckpointState,
  BrowserFingerprint,
  BrowserScreen,
  BrowserSessionStatus,
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  Viewport,
} from './protocol.js';

// Export error classes (safe for all environments - just classes)
export {
  ConnectionError,
  TimeoutError,
  ApiError,
  SessionNotFoundError,
  SessionStoppedError,
  SessionNotConnectedError,
  BrowserError,
  NavigationError,
  ScreenshotError,
  ContainerStartError,
  ContainerCrashError,
  type AgentCastError,
  type ConnectionErrors,
  type SessionErrors,
  type BrowserErrors,
  type ContainerErrors,
} from './errors.js';

export {
  ContainerOperationError,
  classifyError,
  createRetryPolicy,
  errorInfo,
  containerStartRetryPolicy,
  instructionRetryPolicy,
  type ClassifiedError,
  type ErrorClassification,
  type ErrorInfo,
  type RetryPolicy,
} from './error-retry.js';

export {
  DEFAULT_SESSION_STOP_TIMEOUT_MS,
  planSessionStops,
  stopSessionsInParallel,
  withStopTimeout,
  type ClosableSession,
  type SessionStopPlan,
} from './session-stop.js';

export {
  NETWORK_HAR_ID_PATTERN,
  NETWORK_HOSTNAME_PATTERN,
  buildNetworkReceipt,
  hasForbiddenNetworkHeaders,
  isNetworkHarId,
  parseNetworkRecordRequest,
  parseNetworkReplayRequest,
  redactNetworkCapture,
  redactNetworkUrl,
  type NetworkHttpMethod,
  type NetworkReceipt,
  type NetworkReceiptEntry,
  type NetworkRecordHandle,
  type NetworkRecordRequest,
  type NetworkRecordStatus,
  type NetworkReplayRequest,
  type NetworkReplayResult,
  type NetworkReplayStatus,
  type NetworkResourceType,
  type RawNetworkCapture,
} from './network-har.js';

export {
  AGENTCAST_PRODUCTION_API_ORIGIN,
  AGENTCAST_PRODUCTION_APP_ORIGIN,
  AgentCastHost,
  assertPublicNetworkReceipt,
  classifyAgentCastPath,
  resolveAgentCastApiOrigin,
  type AgentCastHostOptions,
  type AgentCastTransport,
  type CreateHostSessionRequest,
  type HostInstructionResult,
  type HostNetworkReplayResult,
  type HostSessionStatus,
} from './host.js';

