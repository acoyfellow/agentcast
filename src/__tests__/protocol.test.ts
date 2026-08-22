import { describe, expect, it } from 'vitest';
import type {
  BrowserCheckpointState,
  BrowserFingerprint,
  BrowserSessionStatus,
  JsonObject,
  JsonValue,
  Viewport,
} from '../protocol.js';
import type { BrowserCheckpointState as ClientBrowserCheckpointState } from '../client.js';
import type { BrowserCheckpointState as SdkBrowserCheckpointState } from '../index.js';

const viewport = {
  width: 1280,
  height: 720,
} satisfies Viewport;

const metadata = {
  attempt: 2,
  completed: false,
  labels: ['checkout', 'retry'],
  nested: { source: 'agent' },
} satisfies JsonObject;

const fingerprint = {
  userAgent: 'AgentCast',
  languages: ['en-US'],
  viewport,
  fingerprint: metadata,
} satisfies BrowserFingerprint;

const checkpoint = {
  url: 'https://example.com/checkout',
  viewport,
  fingerprint,
  storage: metadata,
  metadata,
} satisfies BrowserCheckpointState;

const clientCheckpoint: ClientBrowserCheckpointState = checkpoint;
const sdkCheckpoint: SdkBrowserCheckpointState = checkpoint;

describe('protocol contracts', () => {
  it('models serializable browser checkpoints without runtime dependencies', () => {
    const status: BrowserSessionStatus = 'ready';
    const value: JsonValue = checkpoint.metadata;

    expect(status).toBe('ready');
    expect(value).toEqual(metadata);
    expect(checkpoint.viewport).toEqual(viewport);
    expect(clientCheckpoint.url).toBe(checkpoint.url);
    expect(sdkCheckpoint.url).toBe(checkpoint.url);
  });
});
