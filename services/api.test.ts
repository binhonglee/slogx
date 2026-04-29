import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateWsUrl, connectToLogStream } from './api';
import { LogLevel } from '../types';

describe('validateWsUrl', () => {
  describe('valid URLs', () => {
    it('accepts localhost:port format', () => {
      const result = validateWsUrl('localhost:8080');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://localhost:8080');
      }
    });

    it('accepts ws:// protocol', () => {
      const result = validateWsUrl('ws://example.com:8080');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://example.com:8080');
      }
    });

    it('accepts wss:// protocol', () => {
      const result = validateWsUrl('wss://secure.example.com');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('wss://secure.example.com');
      }
    });

    it('converts http:// to ws://', () => {
      const result = validateWsUrl('http://example.com:8080');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://example.com:8080');
      }
    });

    it('converts https:// to wss://', () => {
      const result = validateWsUrl('https://secure.example.com');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('wss://secure.example.com');
      }
    });

    it('accepts relative paths', () => {
      const result = validateWsUrl('/slogx');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('/slogx');
      }
    });

    it('accepts IP addresses', () => {
      const result = validateWsUrl('192.168.1.1:8080');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://192.168.1.1:8080');
      }
    });

    it('trims whitespace', () => {
      const result = validateWsUrl('  localhost:8080  ');
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.url).toBe('ws://localhost:8080');
      }
    });
  });

  describe('invalid URLs', () => {
    it('rejects empty string', () => {
      const result = validateWsUrl('');
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.error).toBe('URL cannot be empty');
      }
    });

    it('rejects whitespace-only string', () => {
      const result = validateWsUrl('   ');
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.error).toBe('URL cannot be empty');
      }
    });

    it('rejects URLs with internal whitespace', () => {
      const result = validateWsUrl('local host:8080');
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.error).toBe('URL cannot contain whitespace');
      }
    });

    it('rejects invalid URL format', () => {
      const result = validateWsUrl('not a valid url');
      expect(result.valid).toBe(false);
    });
  });
});

describe('connectToLogStream', () => {
  let mockWsInstances: any[];
  let OrigWebSocket: typeof WebSocket;

  beforeEach(() => {
    mockWsInstances = [];
    OrigWebSocket = globalThis.WebSocket;

    // Use a class-based mock that works with `new` and test setup's monkey-patching
    class MockWS {
      url: string;
      readyState: number = 0;
      onopen: ((ev: any) => void) | null = null;
      onclose: ((ev: any) => void) | null = null;
      onerror: ((ev: any) => void) | null = null;
      onmessage: ((ev: any) => void) | null = null;
      close = vi.fn();
      send = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();

      constructor(url: string) {
        this.url = url;
        mockWsInstances.push(this);
      }
    }

    globalThis.WebSocket = MockWS as any;
  });

  afterEach(() => {
    globalThis.WebSocket = OrigWebSocket;
    vi.restoreAllMocks();
  });

  it('creates a WebSocket connection with ws:// URL', () => {
    const cleanup = connectToLogStream('ws://localhost:8080', vi.fn(), vi.fn());

    expect(mockWsInstances).toHaveLength(1);
    expect(mockWsInstances[0].url).toBe('ws://localhost:8080');

    cleanup();
  });

  it('normalizes http:// to ws://', () => {
    const cleanup = connectToLogStream('http://localhost:8080', vi.fn(), vi.fn());

    expect(mockWsInstances[0].url).toBe('ws://localhost:8080');
    cleanup();
  });

  it('adds ws:// when no protocol is specified', () => {
    const cleanup = connectToLogStream('localhost:8080', vi.fn(), vi.fn());

    expect(mockWsInstances[0].url).toBe('ws://localhost:8080');
    cleanup();
  });

  it('handles relative path URLs using window.location', () => {
    const cleanup = connectToLogStream('/slogx', vi.fn(), vi.fn());

    // jsdom location includes port from vite config
    expect(mockWsInstances[0].url).toContain('/slogx');
    expect(mockWsInstances[0].url).toMatch(/^wss?:\/\//);
    cleanup();
  });

  it('calls onStatus(true) when connection opens', () => {
    const onStatus = vi.fn();
    const cleanup = connectToLogStream('ws://localhost:8080', vi.fn(), onStatus);

    mockWsInstances[0].onopen!({});

    expect(onStatus).toHaveBeenCalledWith(true);
    cleanup();
  });

  it('calls onStatus(false) when connection closes and retries', async () => {
    vi.useFakeTimers();
    const onStatus = vi.fn();
    const cleanup = connectToLogStream('ws://localhost:8080', vi.fn(), onStatus);

    mockWsInstances[0].onopen!({});
    onStatus.mockClear();
    mockWsInstances[0].onclose!({});

    expect(onStatus).toHaveBeenCalledWith(false);

    // Retry should happen after 2s
    vi.advanceTimersByTime(2000);
    expect(mockWsInstances).toHaveLength(2);

    cleanup();
    vi.useRealTimers();
  });

  it('parses and delivers valid log messages', () => {
    const onLogs = vi.fn();
    const cleanup = connectToLogStream('ws://localhost:8080', onLogs, vi.fn());

    const validLog = {
      id: 'test-1',
      timestamp: new Date().toISOString(),
      level: 'INFO',
      args: ['hello'],
      metadata: { service: 'test' },
    };

    mockWsInstances[0].onmessage!({ data: JSON.stringify(validLog) });

    expect(onLogs).toHaveBeenCalledTimes(1);
    const delivered = onLogs.mock.calls[0][0];
    expect(delivered).toHaveLength(1);
    expect(delivered[0].id).toBe('test-1');
    expect(delivered[0].source).toBe('ws://localhost:8080');

    cleanup();
  });

  it('handles array of log messages', () => {
    const onLogs = vi.fn();
    const cleanup = connectToLogStream('ws://localhost:8080', onLogs, vi.fn());

    const logs = [
      { id: 'a', timestamp: new Date().toISOString(), level: 'INFO', args: ['one'], metadata: { service: 'test' } },
      { id: 'b', timestamp: new Date().toISOString(), level: 'WARN', args: ['two'], metadata: { service: 'test' } },
    ];

    mockWsInstances[0].onmessage!({ data: JSON.stringify(logs) });

    expect(onLogs).toHaveBeenCalledTimes(1);
    expect(onLogs.mock.calls[0][0]).toHaveLength(2);

    cleanup();
  });

  it('silently drops invalid log messages', () => {
    const onLogs = vi.fn();
    const cleanup = connectToLogStream('ws://localhost:8080', onLogs, vi.fn());

    mockWsInstances[0].onmessage!({ data: JSON.stringify({ invalid: true }) });

    expect(onLogs).not.toHaveBeenCalled();
    cleanup();
  });

  it('handles malformed JSON gracefully', () => {
    const onLogs = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cleanup = connectToLogStream('ws://localhost:8080', onLogs, vi.fn());

    mockWsInstances[0].onmessage!({ data: 'not json' });

    expect(onLogs).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    cleanup();
  });

  it('closes WebSocket on error', () => {
    const cleanup = connectToLogStream('ws://localhost:8080', vi.fn(), vi.fn());

    mockWsInstances[0].onerror!(new Event('error'));

    expect(mockWsInstances[0].close).toHaveBeenCalled();
    cleanup();
  });

  it('cleanup nullifies onclose and closes WebSocket', () => {
    const cleanup = connectToLogStream('ws://localhost:8080', vi.fn(), vi.fn());

    cleanup();

    expect(mockWsInstances[0].close).toHaveBeenCalled();
  });
});
