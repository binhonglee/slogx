import { WebSocketServer, WebSocket } from 'ws';

export interface TestServer {
  port: number;
  wss: WebSocketServer;
  clients: Set<WebSocket>;
  sendLog: (log: any) => void;
  waitForConnection: () => Promise<WebSocket>;
  close: () => Promise<void>;
}

export async function createTestServer(port: number = 0): Promise<TestServer> {
  const wss = new WebSocketServer({ port });
  
  await new Promise<void>((resolve) => {
    wss.on('listening', resolve);
  });

  const address = wss.address();
  const actualPort = typeof address === 'string' ? port : address.port;

  const clients = new Set<WebSocket>();
  
  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });

  return {
    port: actualPort,
    wss,
    clients,
    sendLog: (log: any) => {
      const message = typeof log === 'string' ? log : JSON.stringify(log);
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      }
    },
    waitForConnection: () => {
      return new Promise<WebSocket>((resolve) => {
        if (clients.size > 0) {
          resolve(Array.from(clients)[0]);
          return;
        }
        wss.once('connection', (ws: WebSocket) => resolve(ws));
      });
    },
    close: () => {
      return new Promise<void>((resolve, reject) => {
        for (const client of clients) {
          client.terminate();
        }
        clients.clear();
        wss.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  };
}
