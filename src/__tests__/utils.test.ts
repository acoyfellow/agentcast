import { describe, it, expect } from 'vitest';

// Note: These utilities are currently in sessions.svelte.ts
// They should be extracted to a shared utils file for testing
// For now, we'll test the error classes and constants

import {
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
  ERROR_CODES,
  SERVER_STATUS,
  CLIENT_STATUS,
  DEFAULTS,
} from '../index.js';

describe('Error Classes', () => {
  it('should create ConnectionError with message', () => {
    const error = new ConnectionError({ message: 'Connection failed' });
    expect(error).toBeInstanceOf(ConnectionError);
    expect(error.message).toBe('Connection failed');
  });

  it('should create TimeoutError with duration and operation', () => {
    const error = new TimeoutError({
      message: 'Request timed out',
      duration: 5000,
      operation: 'fetch',
    });
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.duration).toBe(5000);
    expect(error.operation).toBe('fetch');
  });

  it('should create ContainerStartError with sessionId', () => {
    const error = new ContainerStartError({
      message: 'Failed to start',
      sessionId: 'test-session',
    });
    expect(error).toBeInstanceOf(ContainerStartError);
    expect(error.sessionId).toBe('test-session');
  });
});

describe('Constants', () => {
  it('should export SERVER_STATUS constants', () => {
    expect(SERVER_STATUS.STARTING).toBe('starting');
    expect(SERVER_STATUS.READY).toBe('ready');
    expect(SERVER_STATUS.STOPPED).toBe('stopped');
    expect(SERVER_STATUS.ERROR).toBe('error');
  });

  it('should export CLIENT_STATUS constants', () => {
    expect(CLIENT_STATUS.CONNECTING).toBe('connecting');
    expect(CLIENT_STATUS.CONNECTED).toBe('connected');
    expect(CLIENT_STATUS.DISCONNECTED).toBe('disconnected');
  });

  it('should export ERROR_CODES constants', () => {
    expect(ERROR_CODES.CONTAINER_START_FAILED).toBe('CONTAINER_START_FAILED');
    expect(ERROR_CODES.BROWSER_NOT_READY).toBe('BROWSER_NOT_READY');
    expect(ERROR_CODES.INVALID_VIEWPORT).toBe('INVALID_VIEWPORT');
  });

  it('should export DEFAULTS', () => {
    expect(DEFAULTS.VIEWPORT.WIDTH).toBe(1280);
    expect(DEFAULTS.VIEWPORT.HEIGHT).toBe(720);
    expect(DEFAULTS.COLOR_SCHEME).toBe('dark');
    expect(DEFAULTS.CONFIRMATION_TIMEOUT_MS).toBe(60000);
  });
});

