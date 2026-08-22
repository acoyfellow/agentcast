import { describe, expect, it } from 'vitest';
import { ContainerOperationError } from '../error-retry.js';
import {
  AGENTCAST_PRODUCTION_API_ORIGIN,
  AgentCastHost,
  assertPublicNetworkReceipt,
  classifyAgentCastPath,
  resolveAgentCastApiOrigin,
} from '../host.js';

const sessionId = '123e4567-e89b-42d3-a456-426614174000';
const targetSessionId = '123e4567-e89b-42d3-a456-426614174002';
const recordId = '123e4567-e89b-42d3-a456-426614174010';
const receiptId = '123e4567-e89b-42d3-a456-426614174011';

const publicReceipt = {
  receiptId,
  recordId,
  createdAt: 1,
  entryCount: 1,
  entries: [{
    method: 'GET',
    status: 200,
    type: 'xhr',
    origin: 'https://api.agentcast.dev',
    hostname: 'api.agentcast.dev',
    startedAt: 1,
    durationMs: 12,
    requestBytes: 40,
    responseBytes: 80,
  }],
};

function mockFetch(handler: (url: string, init?: RequestInit) => unknown): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const payload = await handler(url, init);
    if (payload instanceof Response) return payload;
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

describe('agentcast host HTTP client', () => {
  it('classifies control as HTTP and viewer/CDP as WebSocket, never SSE', () => {
    expect(classifyAgentCastPath('/api/session')).toBe('http');
    expect(classifyAgentCastPath('/api/session/x/network-har/start')).toBe('http');
    expect(classifyAgentCastPath('/cdp/x')).toBe('websocket');
    expect(classifyAgentCastPath('/ws/x')).toBe('websocket');
    expect(classifyAgentCastPath('/view/x')).toBe('websocket');
    expect(resolveAgentCastApiOrigin()).toBe(AGENTCAST_PRODUCTION_API_ORIGIN);
    expect(() => resolveAgentCastApiOrigin('https://agentcast-worker.coy.workers.dev')).toThrow(/workers.dev/);
    expect(() => resolveAgentCastApiOrigin('http://api.agentcast.dev')).toThrow(/https/);
  });

  it('creates, wakes, instructs, and records over ordinary HTTP with a bearer token', async () => {
    const calls: Array<{ url: string; method: string; auth: string | null; body: string | null }> = [];
    const host = new AgentCastHost({
      token: 'cap-token',
      fetch: mockFetch((url, init) => {
        calls.push({
          url,
          method: init?.method ?? 'GET',
          auth: new Headers(init?.headers).get('Authorization'),
          body: typeof init?.body === 'string' ? init.body : null,
        });
        if (url.endsWith('/api/session') && init?.method === 'POST') return { success: true, data: { sessionId } };
        if (url.endsWith(`/api/session/${sessionId}/wake`)) return { success: true, status: { id: sessionId, status: 'ready' } };
        if (url.endsWith(`/api/session/${sessionId}/instruction`)) return { success: true, response: 'ok' };
        if (url.endsWith(`/api/session/${sessionId}/network-har/start`)) {
          return { success: true, record: { recordId, status: 'recording', startedAt: 1 } };
        }
        if (url.endsWith(`/api/session/${sessionId}/network-har/stop`)) return { success: true, receipt: publicReceipt };
        if (url.endsWith(`/api/session/${sessionId}/network-har`)) return { success: true, receipts: [publicReceipt] };
        if (url.endsWith(`/replay`)) return { success: true, receipt: publicReceipt, result: { success: true, replayed: 1 } };
        throw new Error(`unexpected ${url}`);
      }),
    });

    expect(await host.createSession({ name: 'my-ax' })).toEqual({ sessionId });
    expect((await host.instruct(sessionId, 'goto https://agentcast.dev')).success).toBe(true);
    const record = await host.startNetworkRecord(sessionId, { maxDurationMs: 8_000, maxEntries: 20 });
    const receipt = await host.stopNetworkRecord(sessionId);
    const listed = await host.listNetworkReceipts(sessionId);
    const replay = await host.replayNetworkRecord(sessionId, { receiptId, recordId, targetSessionId });

    expect(record.recordId).toBe(recordId);
    expect(receipt).toEqual(publicReceipt);
    expect(listed).toEqual([publicReceipt]);
    expect(replay.replayed).toBe(1);
    expect(calls.every((call) => call.auth === 'Bearer cap-token')).toBe(true);
    expect(calls.map((call) => `${call.method} ${new URL(call.url).pathname}`)).toEqual([
      'POST /api/session',
      'POST /api/session/123e4567-e89b-42d3-a456-426614174000/instruction',
      'POST /api/session/123e4567-e89b-42d3-a456-426614174000/wake',
      'POST /api/session/123e4567-e89b-42d3-a456-426614174000/network-har/start',
      'POST /api/session/123e4567-e89b-42d3-a456-426614174000/network-har/stop',
      'GET /api/session/123e4567-e89b-42d3-a456-426614174000/network-har',
      'POST /api/session/123e4567-e89b-42d3-a456-426614174000/network-har/123e4567-e89b-42d3-a456-426614174011/replay',
    ]);
    expect(calls.some((call) => call.url.includes('/cdp/') || call.url.includes('event-stream'))).toBe(false);
    expect(JSON.stringify(receipt)).not.toMatch(/cookie|authorization|token=|\/private/i);
  });

  it('rejects a receipt that still has raw URL or credential fields', () => {
    expect(() => assertPublicNetworkReceipt({
      receiptId,
      recordId,
      createdAt: 1,
      entryCount: 1,
      entries: [{
        method: 'GET',
        status: 200,
        type: 'xhr',
        origin: 'https://api.agentcast.dev',
        hostname: 'api.agentcast.dev',
        startedAt: 1,
        durationMs: 1,
        requestBytes: 1,
        responseBytes: 1,
        url: 'https://api.agentcast.dev/private?token=1',
      }],
    })).toThrow(/leaked url/);
    expect(() => assertPublicNetworkReceipt({
      receiptId,
      recordId,
      createdAt: 1,
      entries: [],
      cookie: 'sid=1',
    })).toThrow(/secret field/);
  });

  it('surfaces browser-not-ready as a typed host error', async () => {
    const host = new AgentCastHost({
      token: 'cap-token',
      wakeBeforeRecord: false,
      fetch: mockFetch(() => new Response(JSON.stringify({
        success: false,
        error: 'Browser not ready',
        result: { errorCode: 'BROWSER_NOT_READY' },
      }), { status: 502 })),
    });
    await expect(host.startNetworkRecord(sessionId, { maxDurationMs: 5_000, maxEntries: 5 }))
      .rejects.toMatchObject({ name: 'ContainerOperationError', status: 502, message: 'Browser not ready' } satisfies Partial<ContainerOperationError>);
  });
});
