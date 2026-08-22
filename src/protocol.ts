export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface JsonArray extends ReadonlyArray<JsonValue> {}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface BrowserScreen extends Viewport {
  readonly availWidth?: number;
  readonly availHeight?: number;
  readonly colorDepth?: number;
  readonly pixelDepth?: number;
  readonly devicePixelRatio?: number;
}

export interface BrowserFingerprint {
  readonly userAgent?: string;
  readonly platform?: string;
  readonly languages?: readonly string[];
  readonly screen?: BrowserScreen;
  readonly viewport?: Viewport;
  readonly timezone?: string;
  readonly hardwareConcurrency?: number;
  readonly maxTouchPoints?: number;
  readonly fingerprint?: JsonObject;
}

export type BrowserSessionStatus =
  | 'starting'
  | 'ready'
  | 'active'
  | 'idle'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface BrowserCheckpointState {
  readonly url?: string;
  readonly viewport?: Viewport;
  readonly fingerprint?: BrowserFingerprint;
  readonly storage?: JsonObject;
  readonly metadata?: JsonObject;
}
