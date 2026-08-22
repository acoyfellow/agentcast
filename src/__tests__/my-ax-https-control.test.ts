import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AgentCastHost, classifyAgentCastPath } from '../host.js';
import { assertScrubbedHar, createFetchFromHar, type HarLog } from '../har-route.js';

const sessionId = '123e4567-e89b-42d3-a456-426614174000';
const targetSessionId = '123e4567-e89b-42d3-a456-426614174002';
const har = JSON.parse(readFileSync(new URL('../../fixtures/my-ax-https-control.har', import.meta.url), 'utf8')) as HarLog;

describe('my-ax HTTPS control flow from scrubbed HAR', () => {
  it('replays only ordinary HTTP control calls and never CDP or SSE', async () => {
    assertScrubbedHar(har);
    const host = new AgentCastHost({
      token: 'unused-fixture-token',
      fetch: createFetchFromHar(har),
    });
    const result = await host.runMyAxHttpsControlFlow({
      name: 'my-ax',
      instruction: 'goto https://agentcast.dev',
      record: { maxDurationMs: 8_000, maxEntries: 20 },
      replayTargetSessionId: targetSessionId,
    });
    expect(result.sessionId).toBe(sessionId);
    expect(result.status.status).toBe('ready');
    expect(result.instruction.success).toBe(true);
    expect(result.ticketUrl).toBe('https://api.agentcast.dev/ticket/fixture-ticket');
    expect(result.receipt?.entries[0]?.hostname).toBe('api.agentcast.dev');
    expect(result.replayed).toBe(1);
    expect(JSON.stringify(result.receipt)).not.toMatch(/cookie|authorization|token=/i);
    expect(classifyAgentCastPath('/cdp/x')).toBe('websocket');
  });
});

describe('viewer and CDP stay off the HTTP HAR path', () => {
  it('classifies viewer and CDP as WebSocket so they are not HAR-replayed', () => {
    expect(classifyAgentCastPath('/view/x')).toBe('websocket');
    expect(classifyAgentCastPath('/cdp/x')).toBe('websocket');
    expect(classifyAgentCastPath('/ws/x')).toBe('websocket');
    expect(classifyAgentCastPath('/ticket/x')).toBe('websocket');
    expect(classifyAgentCastPath('/api/session/x/view-ticket')).toBe('http');
  });
});
