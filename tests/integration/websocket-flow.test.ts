// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createTestServer, TestServer } from '../fixtures/testServer';
import { createLogEntry } from '../fixtures';
import { LogLevel } from '../../types';
import WebSocket from 'ws';

describe('WebSocket Flow', () => {
  let server: TestServer;
  
  beforeAll(async () => {
    server = await createTestServer(0);
  });
  
  afterAll(async () => {
    await server.close();
  });

  it('client connects and receives logs', async () => {
    const client = new WebSocket(`ws://localhost:${server.port}`);
    await new Promise(resolve => client.once('open', resolve));
    
    const messages: any[] = [];
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });
    
    await server.waitForConnection();
    
    // Server sends a log
    const testLog = createLogEntry({ id: 'ws-flow-1', level: LogLevel.DEBUG });
    server.sendLog(testLog);
    
    // Wait for the client to receive it
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('ws-flow-1');
    expect(messages[0].level).toBe('DEBUG');
    
    client.close();
  });

  it('handles rapid message bursts (100+ logs)', async () => {
    const client = new WebSocket(`ws://localhost:${server.port}`);
    await new Promise(resolve => client.once('open', resolve));
    
    const messages: any[] = [];
    client.on('message', (data) => {
      messages.push(JSON.parse(data.toString()));
    });
    
    await server.waitForConnection();
    
    for (let i = 0; i < 150; i++) {
      server.sendLog(createLogEntry({ id: `burst-${i}` }));
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(messages).toHaveLength(150);
    expect(messages[149].id).toBe('burst-149');
    
    client.close();
  });

  it('connection close and error events propagate correctly', async () => {
    const client = new WebSocket(`ws://localhost:${server.port}`);
    await new Promise(resolve => client.once('open', resolve));
    let closeFired = false;
    
    client.on('close', () => {
      closeFired = true;
    });

    const serverWs = await server.waitForConnection();
    
    // Drop connection from server side
    serverWs.close();
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    expect(closeFired).toBe(true);
  });
});
