export const NETWORK_HAR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const NETWORK_HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;

export type NetworkHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type NetworkResourceType = 'document' | 'xhr' | 'fetch' | 'script' | 'stylesheet' | 'image' | 'font' | 'websocket' | 'other';
export type NetworkRecordStatus = 'recording' | 'stopped';
export type NetworkReplayStatus = 'accepted' | 'replaying' | 'completed' | 'failed';

export interface NetworkRecordRequest {
  readonly maxDurationMs: number;
  readonly maxEntries: number;
}

export interface NetworkRecordHandle {
  readonly recordId: string;
  readonly status: NetworkRecordStatus;
  readonly startedAt: number;
}

export interface NetworkReceiptEntry {
  readonly method: NetworkHttpMethod;
  readonly status: number;
  readonly type: NetworkResourceType;
  readonly origin: string;
  readonly hostname: string;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly requestBytes: number;
  readonly responseBytes: number;
}

export interface NetworkReceipt {
  readonly receiptId: string;
  readonly recordId: string;
  readonly createdAt: number;
  readonly entryCount: number;
  readonly entries: readonly NetworkReceiptEntry[];
}

export interface NetworkReplayRequest {
  readonly recordId: string;
  readonly targetSessionId: string;
}

export interface NetworkReplayResult {
  readonly replayId: string;
  readonly recordId: string;
  readonly targetSessionId: string;
  readonly status: NetworkReplayStatus;
}

export interface RawNetworkCapture {
  readonly url?: string;
  readonly method?: string;
  readonly status?: number;
  readonly type?: string;
  readonly startedDateTime?: string;
  readonly time?: number;
  readonly requestHeaders?: Readonly<Record<string, string>>;
  readonly responseHeaders?: Readonly<Record<string, string>>;
  readonly requestBody?: string;
  readonly responseBody?: string;
  readonly requestBytes?: number;
  readonly responseBytes?: number;
}

const methods = new Set<NetworkHttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const resourceTypes = new Set<NetworkResourceType>(['document', 'xhr', 'fetch', 'script', 'stylesheet', 'image', 'font', 'websocket', 'other']);
const forbiddenHeaderNames = new Set(['cookie', 'set-cookie', 'authorization', 'proxy-authorization', 'cookie2']);

export function isNetworkHarId(value: string): boolean {
  return NETWORK_HAR_ID_PATTERN.test(value);
}

export function parseNetworkRecordRequest(input: NetworkRecordRequest): NetworkRecordRequest {
  if (!Number.isInteger(input.maxDurationMs) || input.maxDurationMs < 1_000 || input.maxDurationMs > 300_000) {
    throw new RangeError('maxDurationMs must be an integer between 1000 and 300000');
  }
  if (!Number.isInteger(input.maxEntries) || input.maxEntries < 1 || input.maxEntries > 5_000) {
    throw new RangeError('maxEntries must be an integer between 1 and 5000');
  }
  return { maxDurationMs: input.maxDurationMs, maxEntries: input.maxEntries };
}

export function redactNetworkUrl(url: string): { origin: string; hostname: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!NETWORK_HOSTNAME_PATTERN.test(parsed.hostname)) return null;
    return { origin: parsed.origin, hostname: parsed.hostname };
  } catch {
    return null;
  }
}

function parseMethod(value: string | undefined): NetworkHttpMethod | null {
  if (!value) return null;
  const method = value.toUpperCase();
  return methods.has(method as NetworkHttpMethod) ? method as NetworkHttpMethod : null;
}

function parseType(value: string | undefined): NetworkResourceType {
  if (value && resourceTypes.has(value as NetworkResourceType)) return value as NetworkResourceType;
  return 'other';
}

function startedAt(value: string | undefined): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function hasForbiddenNetworkHeaders(headers: Readonly<Record<string, string>> | undefined): boolean {
  if (!headers) return false;
  return Object.keys(headers).some((name) => forbiddenHeaderNames.has(name.toLowerCase()));
}

export function redactNetworkCapture(capture: RawNetworkCapture): NetworkReceiptEntry | null {
  if (!capture.url || capture.requestBody !== undefined || capture.responseBody !== undefined) return null;
  if (hasForbiddenNetworkHeaders(capture.requestHeaders) || hasForbiddenNetworkHeaders(capture.responseHeaders)) return null;
  const location = redactNetworkUrl(capture.url);
  const method = parseMethod(capture.method);
  const at = startedAt(capture.startedDateTime);
  if (!location || !method || at === null) return null;
  if (!Number.isInteger(capture.status) || (capture.status ?? 0) < 100 || (capture.status ?? 0) > 599) return null;
  if (capture.time !== undefined && !(Number.isFinite(capture.time) && capture.time >= 0)) return null;
  if (capture.requestBytes !== undefined && !(Number.isInteger(capture.requestBytes) && capture.requestBytes >= 0)) return null;
  if (capture.responseBytes !== undefined && !(Number.isInteger(capture.responseBytes) && capture.responseBytes >= 0)) return null;
  return {
    method,
    status: capture.status ?? 0,
    type: parseType(capture.type),
    origin: location.origin,
    hostname: location.hostname,
    startedAt: at,
    durationMs: capture.time ?? 0,
    requestBytes: capture.requestBytes ?? 0,
    responseBytes: capture.responseBytes ?? 0,
  };
}

export function buildNetworkReceipt(
  recordId: string,
  receiptId: string,
  createdAt: number,
  captures: readonly RawNetworkCapture[],
  maxEntries: number,
): NetworkReceipt {
  if (!isNetworkHarId(recordId) || !isNetworkHarId(receiptId)) throw new RangeError('recordId and receiptId must be UUIDs');
  const entries = captures.map(redactNetworkCapture).filter((entry): entry is NetworkReceiptEntry => entry !== null)
    .slice(0, maxEntries);
  return { receiptId, recordId, createdAt, entryCount: entries.length, entries };
}

export function parseNetworkReplayRequest(input: NetworkReplayRequest): NetworkReplayRequest {
  if (!isNetworkHarId(input.recordId) || !isNetworkHarId(input.targetSessionId)) {
    throw new RangeError('recordId and targetSessionId must be UUIDs');
  }
  return { recordId: input.recordId, targetSessionId: input.targetSessionId };
}
