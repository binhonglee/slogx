import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { SlogxConnection, ConnectionManager } from './connection.js';
import { LogEntry } from './types.js';

describe('SlogxConnection', () => {
  let server: WebSocketServer;
  let serverPort: number;

  beforeEach(async () => {
    // Create a test WebSocket server
    server = new WebSocketServer({ port: 0 });
    serverPort = (server.address() as { port: number }).port;
  });

  afterEach(() => {
    server.close();
  });

  it('connects to a WebSocket server', async () => {
    const conn = new SlogxConnection(`ws://localhost:${serverPort}`);
    await conn.connect();

    expect(conn.status).toBe('connected');
    conn.disconnect();
  });

  it('receives and buffers log entries', async () => {
    const conn = new SlogxConnection(`ws://localhost:${serverPort}`);

    server.on('connection', (ws) => {
      const entry: LogEntry = {
        id: 'log-1',
        timestamp: '2025-01-15T10:30:45.123Z',
        level: 'INFO',
        args: ['Test message'],
        metadata: { service: 'test-service', file: 'test.ts', line: 10 }
      };
      ws.send(JSON.stringify(entry));
    });

    await conn.connect();

    // Wait for message to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(conn.service).toBe('test-service');
    const logs = conn.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].id).toBe('log-1');

    conn.disconnect();
  });

  it('searches logs by query', async () => {
    const conn = new SlogxConnection(`ws://localhost:${serverPort}`);

    server.on('connection', (ws) => {
      const entries: LogEntry[] = [
        {
          id: 'log-1',
          timestamp: '2025-01-15T10:30:45.123Z',
          level: 'INFO',
          args: ['Payment processed'],
          metadata: { service: 'checkout' }
        },
        {
          id: 'log-2',
          timestamp: '2025-01-15T10:30:46.123Z',
          level: 'ERROR',
          args: ['Payment failed'],
          metadata: { service: 'checkout' }
        },
        {
          id: 'log-3',
          timestamp: '2025-01-15T10:30:47.123Z',
          level: 'INFO',
          args: ['User logged in'],
          metadata: { service: 'auth' }
        }
      ];
      entries.forEach(e => ws.send(JSON.stringify(e)));
    });

    await conn.connect();
    await new Promise(resolve => setTimeout(resolve, 100));

    const result = conn.search('Payment');
    expect(result.total).toBe(2);
    expect(result.logs.length).toBe(2);

    conn.disconnect();
  });

  it('filters logs by level', async () => {
    const conn = new SlogxConnection(`ws://localhost:${serverPort}`);

    server.on('connection', (ws) => {
      const entries: LogEntry[] = [
        { id: '1', timestamp: '2025-01-15T10:30:45Z', level: 'INFO', args: ['info'], metadata: { service: 'app' } },
        { id: '2', timestamp: '2025-01-15T10:30:46Z', level: 'ERROR', args: ['error'], metadata: { service: 'app' } },
        { id: '3', timestamp: '2025-01-15T10:30:47Z', level: 'INFO', args: ['info2'], metadata: { service: 'app' } }
      ];
      entries.forEach(e => ws.send(JSON.stringify(e)));
    });

    await conn.connect();
    await new Promise(resolve => setTimeout(resolve, 100));

    const errors = conn.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].content).toContain('ERROR');

    conn.disconnect();
  });

  it('gets log details by id', async () => {
    const conn = new SlogxConnection(`ws://localhost:${serverPort}`);

    const testEntry: LogEntry = {
      id: 'detail-test',
      timestamp: '2025-01-15T10:30:45.123Z',
      level: 'ERROR',
      args: ['Detailed error', { code: 500 }],
      stacktrace: 'Error: test\n  at foo.ts:10',
      metadata: { service: 'api', file: 'handler.ts', line: 42, func: 'handleRequest' }
    };

    server.on('connection', (ws) => {
      ws.send(JSON.stringify(testEntry));
    });

    await conn.connect();
    await new Promise(resolve => setTimeout(resolve, 100));

    const entry = conn.getLogById('detail-test');
    expect(entry).toBeDefined();
    expect(entry?.stacktrace).toContain('foo.ts:10');
    expect(entry?.metadata.func).toBe('handleRequest');

    conn.disconnect();
  });

  it('handles connection failure gracefully', async () => {
    const conn = new SlogxConnection('ws://localhost:59999'); // Non-existent port

    await expect(conn.connect()).rejects.toThrow();
    expect(conn.status).toBe('disconnected');
  });
});

describe('ConnectionManager', () => {
  let server: WebSocketServer;
  let serverPort: number;

  beforeEach(async () => {
    server = new WebSocketServer({ port: 0 });
    serverPort = (server.address() as { port: number }).port;
  });

  afterEach(() => {
    server.close();
  });

  it('connects and lists connections', async () => {
    const manager = new ConnectionManager();

    const result = await manager.connect(`ws://localhost:${serverPort}`);
    expect(result.success).toBe(true);

    const list = manager.list();
    expect(list.length).toBe(1);
    expect(list[0].status).toBe('connected');

    manager.disconnect(`ws://localhost:${serverPort}`);
  });

  it('normalizes URLs', async () => {
    const manager = new ConnectionManager();

    // Test http -> ws conversion
    await manager.connect(`http://localhost:${serverPort}`);
    const list = manager.list();
    expect(list[0].url).toBe(`ws://localhost:${serverPort}`);

    manager.disconnect(`ws://localhost:${serverPort}`);
  });

  it('prevents duplicate connections', async () => {
    const manager = new ConnectionManager();

    await manager.connect(`ws://localhost:${serverPort}`);
    const result = await manager.connect(`ws://localhost:${serverPort}`);

    expect(result.success).toBe(true);
    expect(result.message).toContain('Already connected');

    const list = manager.list();
    expect(list.length).toBe(1);

    manager.disconnect(`ws://localhost:${serverPort}`);
  });

  it('aggregates logs from multiple connections', async () => {
    const server2 = new WebSocketServer({ port: 0 });
    const port2 = (server2.address() as { port: number }).port;

    server.on('connection', (ws) => {
      ws.send(JSON.stringify({
        id: 'srv1-log',
        timestamp: '2025-01-15T10:30:45Z',
        level: 'INFO',
        args: ['From server 1'],
        metadata: { service: 'service1' }
      }));
    });

    server2.on('connection', (ws) => {
      ws.send(JSON.stringify({
        id: 'srv2-log',
        timestamp: '2025-01-15T10:30:46Z',
        level: 'INFO',
        args: ['From server 2'],
        metadata: { service: 'service2' }
      }));
    });

    const manager = new ConnectionManager();
    await manager.connect(`ws://localhost:${serverPort}`);
    await manager.connect(`ws://localhost:${port2}`);

    await new Promise(resolve => setTimeout(resolve, 100));

    const logs = manager.getLogs();
    expect(logs.length).toBe(2);

    manager.disconnect(`ws://localhost:${serverPort}`);
    manager.disconnect(`ws://localhost:${port2}`);
    server2.close();
  });

  it('searches across all connections', async () => {
    server.on('connection', (ws) => {
      ws.send(JSON.stringify({
        id: 'payment-log',
        timestamp: '2025-01-15T10:30:45Z',
        level: 'ERROR',
        args: ['Payment failed'],
        metadata: { service: 'checkout' }
      }));
    });

    const manager = new ConnectionManager();
    await manager.connect(`ws://localhost:${serverPort}`);

    await new Promise(resolve => setTimeout(resolve, 100));

    const result = manager.search('Payment');
    expect(result.total).toBe(1);
    expect(result.logs[0].content).toContain('Payment failed');

    manager.disconnect(`ws://localhost:${serverPort}`);
  });
});
