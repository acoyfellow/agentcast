import { describe, expect, it } from 'vitest';
import {
  buildNetworkReceipt,
  parseNetworkRecordRequest,
  parseNetworkReplayRequest,
  redactNetworkCapture,
  redactNetworkUrl,
} from '../network-har.js';

const recordId = '123e4567-e89b-42d3-a456-426614174000';
const receiptId = '123e4567-e89b-42d3-a456-426614174001';
const sessionId = '123e4567-e89b-42d3-a456-426614174002';

describe('network HAR contracts', () => {
  it('redacts captures to origin/hostname and drops secrets', () => {
    expect(redactNetworkUrl('https://user:pass@checkout.example/cart?token=1#frag')).toEqual({
      origin: 'https://checkout.example',
      hostname: 'checkout.example',
    });
    expect(redactNetworkCapture({
      url: 'https://checkout.example/cart?token=1',
      method: 'POST',
      status: 204,
      type: 'fetch',
      startedDateTime: '2026-08-22T12:00:00.000Z',
      time: 42,
      requestHeaders: { Authorization: 'Bearer secret' },
    })).toBeNull();
    expect(redactNetworkCapture({
      url: 'https://checkout.example/cart?token=1',
      method: 'GET',
      status: 200,
      startedDateTime: '2026-08-22T12:00:00.000Z',
      requestBody: '{"card":"4111"}',
    })).toBeNull();
    expect(redactNetworkCapture({
      url: 'https://checkout.example/cart?token=1',
      method: 'GET',
      status: 200,
      type: 'xhr',
      startedDateTime: '2026-08-22T12:00:00.000Z',
      time: 18,
      requestBytes: 120,
      responseBytes: 80,
    })).toEqual({
      method: 'GET',
      status: 200,
      type: 'xhr',
      origin: 'https://checkout.example',
      hostname: 'checkout.example',
      startedAt: Date.parse('2026-08-22T12:00:00.000Z'),
      durationMs: 18,
      requestBytes: 120,
      responseBytes: 80,
    });
  });

  it('builds a bounded receipt and validates record/replay requests', () => {
    const receipt = buildNetworkReceipt(recordId, receiptId, 1, [
      { url: 'https://a.example/', method: 'GET', status: 200, startedDateTime: '2026-08-22T12:00:00.000Z' },
      { url: 'https://b.example/', method: 'GET', status: 200, startedDateTime: '2026-08-22T12:00:01.000Z' },
    ], 1);
    expect(receipt.entryCount).toBe(1);
    expect(receipt.entries[0]?.hostname).toBe('a.example');
    expect(parseNetworkRecordRequest({ maxDurationMs: 30_000, maxEntries: 100 })).toEqual({
      maxDurationMs: 30_000,
      maxEntries: 100,
    });
    expect(parseNetworkReplayRequest({ recordId, targetSessionId: sessionId })).toEqual({
      recordId,
      targetSessionId: sessionId,
    });
    expect(() => parseNetworkRecordRequest({ maxDurationMs: 10, maxEntries: 1 })).toThrow(RangeError);
  });
});
