import { afterEach, afterAll, vi } from 'vitest';

// Track active WebSocket connections for cleanup
const activeConnections = new Set<WebSocket>();

// Monkey-patch WebSocket constructor to track connections
const OriginalWebSocket = globalThis.WebSocket;
if (OriginalWebSocket) {
  globalThis.WebSocket = class extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      activeConnections.add(this);
      this.addEventListener('close', () => {
        activeConnections.delete(this);
      });
    }
  } as typeof WebSocket;
}

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  // Close any lingering WebSocket connections
  for (const ws of activeConnections) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  }
  activeConnections.clear();
});
