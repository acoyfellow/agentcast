import { ApiError, ConnectionError } from './errors.js';
import { ContainerOperationError } from './error-retry.js';
import {
  parseNetworkRecordRequest,
  parseNetworkReplayRequest,
  type NetworkReceipt,
  type NetworkReceiptEntry,
  type NetworkRecordHandle,
  type NetworkRecordRequest,
} from './network-har.js';

export const AGENTCAST_PRODUCTION_API_ORIGIN = 'https://api.agentcast.dev';
export const AGENTCAST_PRODUCTION_APP_ORIGIN = 'https://agentcast.dev';

export type AgentCastTransport = 'http' | 'websocket';

export interface AgentCastHostOptions {
  readonly origin?: string;
  readonly token: string;
  readonly fetch?: typeof fetch;
  readonly wakeBeforeRecord?: boolean;
}

export interface CreateHostSessionRequest {
  readonly name?: string;
  readonly viewport?: { width: number; height: number };
  readonly colorScheme?: 'light' | 'dark';
  readonly takeover?: true;
  readonly profileId?: string;
}

export interface HostSessionStatus {
  readonly id?: string;
  readonly status?: string;
  readonly viewUrl?: string;
  readonly cdpUrl?: string;
  readonly error?: string;
}

export interface HostInstructionResult {
  readonly success: boolean;
  readonly response?: string;
  readonly error?: string;
}

export interface HostNetworkReplayResult {
  readonly success: boolean;
  readonly receipt: NetworkReceipt;
  readonly replayed?: number;
}

export interface WaitForSessionOptions {
  readonly attempts?: number;
  readonly intervalMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface HostViewerTicket {
  readonly ticketUrl: string;
}

export interface MyAxHttpsControlFlowInput {
  readonly name?: string;
  readonly instruction: string;
  readonly record?: NetworkRecordRequest;
  readonly replayTargetSessionId?: string;
}

export interface MyAxHttpsControlFlowResult {
  readonly sessionId: string;
  readonly status: HostSessionStatus;
  readonly instruction: HostInstructionResult;
  readonly ticketUrl?: string;
  readonly receipt?: NetworkReceipt;
  readonly replayed?: number;
}

const receiptEntryKeys = new Set([
  'method',
  'status',
  'type',
  'origin',
  'hostname',
  'startedAt',
  'durationMs',
  'requestBytes',
  'responseBytes',
]);

export function classifyAgentCastPath(path: string): AgentCastTransport {
  if (path.startsWith('/cdp/') || path.startsWith('/ws/') || path.startsWith('/view/') || path.startsWith('/ticket/')) {
    return 'websocket';
  }
  return 'http';
}

export function resolveAgentCastApiOrigin(origin?: string): string {
  const value = origin ?? AGENTCAST_PRODUCTION_API_ORIGIN;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RangeError('AgentCast API origin must be an absolute URL');
  }
  if (parsed.protocol !== 'https:') throw new RangeError('AgentCast API origin must be https');
  if (parsed.hostname.endsWith('.workers.dev')) throw new RangeError('AgentCast API origin must not be workers.dev');
  return parsed.origin;
}

export function assertPublicNetworkReceipt(value: unknown): NetworkReceipt {
  if (!value || typeof value !== 'object') throw new RangeError('Network receipt is required');
  const receipt = value as Record<string, unknown>;
  if (typeof receipt.receiptId !== 'string' || typeof receipt.recordId !== 'string') {
    throw new RangeError('Network receipt identifiers are required');
  }
  if (!Array.isArray(receipt.entries)) throw new RangeError('Network receipt entries are required');
  const encoded = JSON.stringify(receipt).toLowerCase();
  if (encoded.includes('authorization') || encoded.includes('cookie') || encoded.includes('set-cookie') || encoded.includes('bearer ')) {
    throw new RangeError('Network receipt leaked a secret field');
  }
  const entries = receipt.entries.map((entry) => assertPublicReceiptEntry(entry));
  return {
    receiptId: receipt.receiptId,
    recordId: receipt.recordId,
    createdAt: numberOrZero(receipt.createdAt),
    entryCount: numberOrZero(receipt.entryCount ?? entries.length),
    entries,
  };
}

export class AgentCastHost {
  readonly origin: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly wakeBeforeRecord: boolean;

  constructor(options: AgentCastHostOptions) {
    if (!options.token) throw new RangeError('Capability token is required');
    this.origin = resolveAgentCastApiOrigin(options.origin);
    this.token = options.token;
    this.fetchImpl = options.fetch ?? fetch;
    this.wakeBeforeRecord = options.wakeBeforeRecord !== false;
  }

  async createSession(input: CreateHostSessionRequest = {}): Promise<{ sessionId: string }> {
    const body: Record<string, unknown> = {};
    if (input.name) body.name = input.name;
    if (input.viewport) body.viewport = input.viewport;
    if (input.colorScheme) body.colorScheme = input.colorScheme;
    if (input.takeover === true) body.takeover = true;
    const payload = await this.requestJson('POST', '/api/session', body);
    const sessionId = readSessionId(payload);
    if (!sessionId) throw new ApiError({ message: 'Create session did not return a session id', status: 502 });
    return { sessionId };
  }

  async getSession(sessionId: string): Promise<HostSessionStatus> {
    return this.requestJson('GET', `/api/session/${sessionId}`) as Promise<HostSessionStatus>;
  }

  async wakeSession(sessionId: string): Promise<HostSessionStatus> {
    const payload = await this.requestJson('POST', `/api/session/${sessionId}/wake`);
    if (payload && typeof payload === 'object' && 'status' in payload && payload.status && typeof payload.status === 'object') {
      return payload.status as HostSessionStatus;
    }
    return payload as HostSessionStatus;
  }

  async instruct(sessionId: string, instruction: string): Promise<HostInstructionResult> {
    if (!instruction.trim()) throw new RangeError('Instruction is required');
    return this.requestJson('POST', `/api/session/${sessionId}/instruction`, { instruction }) as Promise<HostInstructionResult>;
  }

  async waitForSession(sessionId: string, options: WaitForSessionOptions = {}): Promise<HostSessionStatus> {
    const attempts = options.attempts ?? 30;
    const intervalMs = options.intervalMs ?? 250;
    const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
    if (!Number.isInteger(attempts) || attempts < 1) throw new RangeError('attempts must be a positive integer');
    let last: HostSessionStatus | undefined;
    for (let attempt = 0; attempt < attempts; attempt++) {
      last = await this.getSession(sessionId);
      if (last.status === 'ready' || last.status === 'active') return last;
      if (last.status === 'error') {
        throw new ContainerOperationError(last.error || 'Browser session failed', 502);
      }
      if (attempt < attempts - 1) await sleep(intervalMs);
    }
    throw new ContainerOperationError(last?.error || 'Browser session did not become ready', 503);
  }

  async createViewerTicket(sessionId: string): Promise<HostViewerTicket> {
    const payload = await this.requestJson('POST', `/api/session/${sessionId}/view-ticket`);
    const ticketUrl = payload && typeof payload === 'object' && typeof (payload as { ticketUrl?: unknown }).ticketUrl === 'string'
      ? (payload as { ticketUrl: string }).ticketUrl
      : '';
    if (!ticketUrl) throw new ApiError({ message: 'Viewer ticket was not issued', status: 502 });
    const parsed = new URL(ticketUrl);
    if (parsed.protocol !== 'https:' || parsed.hostname.endsWith('.workers.dev') || !parsed.pathname.startsWith('/ticket/')) {
      throw new ApiError({ message: 'Viewer ticket URL is not a production ticket', status: 502 });
    }
    return { ticketUrl };
  }

  async runMyAxHttpsControlFlow(input: MyAxHttpsControlFlowInput): Promise<MyAxHttpsControlFlowResult> {
    const created = await this.createSession({ name: input.name });
    const status = await this.waitForSession(created.sessionId);
    await this.wakeSession(created.sessionId);
    const instruction = await this.instruct(created.sessionId, input.instruction);
    const ticket = await this.createViewerTicket(created.sessionId);
    let receipt: NetworkReceipt | undefined;
    let replayed: number | undefined;
    if (input.record) {
      await this.startNetworkRecord(created.sessionId, input.record);
      receipt = await this.stopNetworkRecord(created.sessionId);
      if (input.replayTargetSessionId) {
        const replay = await this.replayNetworkRecord(created.sessionId, {
          receiptId: receipt.receiptId,
          recordId: receipt.recordId,
          targetSessionId: input.replayTargetSessionId,
        });
        replayed = replay.replayed;
      }
    }
    return { sessionId: created.sessionId, status, instruction, ticketUrl: ticket.ticketUrl, receipt, replayed };
  }

  async stopSession(sessionId: string): Promise<void> {
    await this.requestJson('POST', `/api/session/${sessionId}/stop`);
  }

  async startNetworkRecord(sessionId: string, input: NetworkRecordRequest): Promise<NetworkRecordHandle> {
    const request = parseNetworkRecordRequest(input);
    if (this.wakeBeforeRecord) await this.wakeSession(sessionId);
    const payload = await this.requestJson('POST', `/api/session/${sessionId}/network-har/start`, request);
    const record = payload && typeof payload === 'object' && 'record' in payload ? (payload as { record: NetworkRecordHandle }).record : null;
    if (!record?.recordId || record.status !== 'recording') {
      throw new ApiError({ message: 'Network recording did not return a handle', status: 502 });
    }
    return record;
  }

  async stopNetworkRecord(sessionId: string): Promise<NetworkReceipt> {
    const payload = await this.requestJson('POST', `/api/session/${sessionId}/network-har/stop`);
    return assertPublicNetworkReceipt((payload as { receipt?: unknown }).receipt);
  }

  async listNetworkReceipts(sessionId: string): Promise<NetworkReceipt[]> {
    const payload = await this.requestJson('GET', `/api/session/${sessionId}/network-har`);
    const receipts = payload && typeof payload === 'object' && Array.isArray((payload as { receipts?: unknown }).receipts)
      ? (payload as { receipts: unknown[] }).receipts
      : [];
    return receipts.map(assertPublicNetworkReceipt);
  }

  async replayNetworkRecord(sessionId: string, input: { receiptId: string; recordId: string; targetSessionId: string }): Promise<HostNetworkReplayResult> {
    parseNetworkReplayRequest({ recordId: input.recordId, targetSessionId: input.targetSessionId });
    const payload = await this.requestJson('POST', `/api/session/${sessionId}/network-har/${input.receiptId}/replay`, {
      recordId: input.recordId,
      targetSessionId: input.targetSessionId,
    });
    const receipt = assertPublicNetworkReceipt((payload as { receipt?: unknown }).receipt);
    const result = payload && typeof payload === 'object' && 'result' in payload
      ? (payload as { result?: { replayed?: number; success?: boolean } }).result
      : undefined;
    return {
      success: Boolean((payload as { success?: boolean }).success),
      receipt,
      replayed: result?.replayed,
    };
  }

  private async requestJson(method: string, path: string, body?: unknown): Promise<unknown> {
    if (classifyAgentCastPath(path) !== 'http') {
      throw new RangeError(`AgentCast host client only sends ordinary HTTP, not ${path}`);
    }
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, `${this.origin}/`).toString(), {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw new ConnectionError({
        message: error instanceof Error ? error.message : 'AgentCast request failed',
        url: `${this.origin}${path}`,
        cause: error,
      });
    }
    const text = await response.text();
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { error: text.slice(0, 300) };
      }
    }
    if (!response.ok) {
      const message = readErrorMessage(payload) || `AgentCast ${method} ${path} failed`;
      throw new ContainerOperationError(message, response.status);
    }
    return payload;
  }
}

function assertPublicReceiptEntry(value: unknown): NetworkReceiptEntry {
  if (!value || typeof value !== 'object') throw new RangeError('Network receipt entry is invalid');
  const entry = value as Record<string, unknown>;
  for (const key of Object.keys(entry)) {
    if (!receiptEntryKeys.has(key)) throw new RangeError(`Network receipt entry leaked ${key}`);
  }
  if (typeof entry.origin !== 'string' || typeof entry.hostname !== 'string') {
    throw new RangeError('Network receipt entry is missing origin metadata');
  }
  return {
    method: entry.method as NetworkReceiptEntry['method'],
    status: numberOrZero(entry.status),
    type: entry.type as NetworkReceiptEntry['type'],
    origin: entry.origin,
    hostname: entry.hostname,
    startedAt: numberOrZero(entry.startedAt),
    durationMs: numberOrZero(entry.durationMs),
    requestBytes: numberOrZero(entry.requestBytes),
    responseBytes: numberOrZero(entry.responseBytes),
  };
}

function readSessionId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as { data?: { sessionId?: unknown }; sessionId?: unknown };
  if (typeof record.data?.sessionId === 'string') return record.data.sessionId;
  if (typeof record.sessionId === 'string') return record.sessionId;
  return undefined;
}

function readErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const error = (payload as { error?: unknown }).error;
  return typeof error === 'string' ? error : undefined;
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
