import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketServer } from 'ws';

// Mock the ws module.
vi.mock('ws', () => {
  const mockClients = new Set<any>();
  const mockWss = {
    on: vi.fn((event: string, handler: Function) => {
      if (event === 'connection') {
        // Store the handler for later use
        (mockWss as any).connectionHandler = handler;
      }
      if (event === 'listening') {
        // Auto-trigger listening event so init() resolves
        setTimeout(() => handler(), 0);
      }
    }),
    close: vi.fn(),
  };

  const MockWebSocketServer = vi.fn(function (_opts?: any) {
    return mockWss;
  });

  (MockWebSocketServer as any).mockInstance = mockWss;
  (MockWebSocketServer as any).mockClients = mockClients;

  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: {
      OPEN: 1,
      CLOSED: 3,
    },
  };
});

// Mock the CIWriter class
vi.mock('./ciWriter', () => {
  return {
    CIWriter: vi.fn().mockImplementation(function () {
      return {
        write: vi.fn(),
        close: vi.fn(),
      };
    }),
  };
});

describe('SlogX SDK', () => {
  let slogx: any;
  let mockWss: any;

  beforeEach(async () => {
    vi.resetModules();
    const module = await import('./slogx');
    slogx = module.slogx;
    mockWss = (WebSocketServer as any).mockInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('init()', () => {
    it('creates WebSocket server with default port', () => {
      slogx.init({ isDev: true });
      expect(WebSocketServer).toHaveBeenCalledWith({ port: 8080 });
    });

    it('creates WebSocket server with custom port', () => {
      slogx.init({ isDev: true, port: 9999 });
      // Check that init was called (the mock captures all calls)
      const calls = (WebSocketServer as any).mock.calls;
      const customPortCall = calls.find((c: any) => c[0]?.port === 9999);
      expect(customPortCall).toBeDefined();
    });

    it('sets up connection handler', () => {
      slogx.init({ isDev: true });
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('logging methods', () => {
    it('has debug method', () => {
      expect(typeof slogx.debug).toBe('function');
    });

    it('has info method', () => {
      expect(typeof slogx.info).toBe('function');
    });

    it('has warn method', () => {
      expect(typeof slogx.warn).toBe('function');
    });

    it('has error method', () => {
      expect(typeof slogx.error).toBe('function');
    });
  });

  describe('message broadcasting', () => {
    it('sends message to connected clients', async () => {
      await slogx.init({ isDev: true });

      // Simulate a client connection
      const mockClient = {
        readyState: 1, // WebSocket.OPEN
        send: vi.fn(),
        on: vi.fn(),
      };

      // Trigger the connection handler
      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockClient);
      }

      // Now log something
      slogx.info('test message');

      // Verify send was called
      expect(mockClient.send).toHaveBeenCalled();

      // Verify the payload structure
      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload).toHaveProperty('id');
      expect(payload).toHaveProperty('timestamp');
      expect(payload).toHaveProperty('level', 'INFO');
      expect(payload).toHaveProperty('args');
      expect(payload.args[0]).toBe('test message');
      expect(payload).toHaveProperty('metadata');
      expect(payload.metadata).toHaveProperty('lang', 'node');
    });

    it('broadcasts correct log level', async () => {
      await slogx.init({ isDev: true });

      const mockClient = {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn(),
      };

      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockClient);
      }

      // Test each level
      const levels = ['debug', 'info', 'warn', 'error'] as const;
      const expectedLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

      levels.forEach((level, i) => {
        mockClient.send.mockClear();
        slogx[level]('test');
        const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
        expect(payload.level).toBe(expectedLevels[i]);
      });
    });

    it('serializes Error objects', async () => {
      await slogx.init({ isDev: true });

      const mockClient = {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn(),
      };

      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockClient);
      }

      const testError = new Error('Test error message');
      slogx.error('Something failed', testError);

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.args[0]).toBe('Something failed');
      expect(payload.args[1]).toHaveProperty('name', 'Error');
      expect(payload.args[1]).toHaveProperty('message', 'Test error message');
      expect(payload.args[1]).toHaveProperty('stack');
    });

    it('handles multiple arguments', async () => {
      await slogx.init({ isDev: true });

      const mockClient = {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn(),
      };

      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockClient);
      }

      slogx.info('User action', { userId: 123 }, 'from IP', '192.168.1.1');

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.args).toHaveLength(4);
      expect(payload.args[0]).toBe('User action');
      expect(payload.args[1]).toEqual({ userId: 123 });
      expect(payload.args[2]).toBe('from IP');
      expect(payload.args[3]).toBe('192.168.1.1');
    });

    it('skips closed clients', async () => {
      await slogx.init({ isDev: true });

      const openClient = {
        readyState: 1, // OPEN
        send: vi.fn(),
        on: vi.fn(),
      };

      const closedClient = {
        readyState: 3, // CLOSED
        send: vi.fn(),
        on: vi.fn(),
      };

      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(openClient);
        connectionHandler(closedClient);
      }

      slogx.info('test');

      expect(openClient.send).toHaveBeenCalled();
      expect(closedClient.send).not.toHaveBeenCalled();
    });
  });

  describe('log entry structure', () => {
    it('includes all required fields', async () => {
      await slogx.init({ isDev: true });

      const mockClient = {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn(),
      };

      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockClient);
      }

      slogx.info('test');

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);

      // Check required fields
      expect(payload.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
      expect(payload.level).toBe('INFO');
      expect(Array.isArray(payload.args)).toBe(true);
      expect(payload.metadata).toBeDefined();
      expect(payload.metadata.lang).toBe('node');
    });

    it('includes service name in metadata', async () => {
      // Re-init with custom service name
      await slogx.init({ isDev: true, serviceName: 'my-custom-service' });

      const mockClient = {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn(),
      };

      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockClient);
      }

      slogx.info('test');

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload.metadata.service).toBe('my-custom-service');
    });

    it('includes caller info in metadata', async () => {
      await slogx.init({ isDev: true });

      const mockClient = {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn(),
      };

      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockClient);
      }

      slogx.info('test');

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      // Should have file info (might be undefined in test env but property should exist)
      expect(payload.metadata).toHaveProperty('file');
      expect(payload.metadata).toHaveProperty('line');
      expect(payload.metadata).toHaveProperty('func');
    });

    it('includes stacktrace', async () => {
      await slogx.init({ isDev: true });

      const mockClient = {
        readyState: 1,
        send: vi.fn(),
        on: vi.fn(),
      };

      const connectionHandler = mockWss.on.mock.calls.find(
        (call: any[]) => call[0] === 'connection'
      )?.[1];

      if (connectionHandler) {
        connectionHandler(mockClient);
      }

      slogx.info('test');

      const payload = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(payload).toHaveProperty('stacktrace');
    });
  });
  describe('CI Mode', () => {
    let CIWriterMock: any;

    beforeEach(async () => {
      // Re-import to get fresh mocks
      vi.resetModules();
      const ciWriterModule = await import('./ciWriter');
      CIWriterMock = ciWriterModule.CIWriter;
      const module = await import('./slogx');
      slogx = module.slogx;
    });

    it('uses WebSocket mode by default when not in CI', async () => {
      vi.stubEnv('CI', ''); // Ensure CI is not set
      await slogx.init({ isDev: true });
      expect(WebSocketServer).toHaveBeenCalled();
      expect(CIWriterMock).not.toHaveBeenCalled();
    });

    it('uses CI mode when ciMode is explicitly true', async () => {
      await slogx.init({ isDev: true, ciMode: true });
      expect(WebSocketServer).not.toHaveBeenCalled();
      expect(CIWriterMock).toHaveBeenCalled();
    });

    it('uses CI mode when CI env var is set', async () => {
      vi.stubEnv('CI', 'true');
      await slogx.init({ isDev: true });
      expect(WebSocketServer).not.toHaveBeenCalled();
      expect(CIWriterMock).toHaveBeenCalled();
    });

    it('respects ciMode: false even if in CI environment', async () => {
      vi.stubEnv('CI', 'true');
      await slogx.init({ isDev: true, ciMode: false });
      expect(WebSocketServer).toHaveBeenCalled();
      expect(CIWriterMock).not.toHaveBeenCalled();
    });

    it('passes correct config to CIWriter', async () => {
      await slogx.init({
        isDev: true,
        ciMode: true,
        logFilePath: './custom.log',
        maxEntries: 500
      });

      expect(CIWriterMock).toHaveBeenCalledWith('./custom.log', 500);
    });

    it('delegates log calls to CIWriter in CI mode', async () => {
      await slogx.init({ isDev: true, ciMode: true });

      const mockWriterInstance = CIWriterMock.mock.instances[0];
      const writeSpy = mockWriterInstance.write;

      slogx.info('test log');

      expect(writeSpy).toHaveBeenCalled();
      const entry = writeSpy.mock.calls[0][0];
      expect(entry.level).toBe('INFO');
      expect(entry.args[0]).toBe('test log');
    });
  });
});
