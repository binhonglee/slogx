import { vi } from 'vitest';

export class MockWebSocket {
  url: string;
  readyState: number = WebSocket.CONNECTING;
  
  onopen: ((ev: Event) => any) | null = null;
  onclose: ((ev: CloseEvent) => any) | null = null;
  onmessage: ((ev: MessageEvent) => any) | null = null;
  onerror: ((ev: Event) => any) | null = null;

  sendMock: ReturnType<typeof vi.fn>;
  closeMock: ReturnType<typeof vi.fn>;

  constructor(url: string) {
    this.url = url;
    this.sendMock = vi.fn();
    this.closeMock = vi.fn().mockImplementation(() => {
      this.readyState = WebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({ type: 'close', wasClean: true, code: 1000, reason: '' } as CloseEvent);
      }
    });
  }

  get send() { return this.sendMock; }
  get close() { return this.closeMock; }

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) this.onopen(new Event('open'));
  }

  simulateMessage(data: any) {
    if (this.onmessage) this.onmessage({ type: 'message', data: typeof data === 'string' ? data : JSON.stringify(data) } as MessageEvent);
  }

  simulateClose(code = 1000, reason = 'Normal closure') {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) this.onclose({ type: 'close', wasClean: true, code, reason } as CloseEvent);
  }

  simulateError() {
    if (this.onerror) this.onerror(new Event('error'));
  }
}

export function createMockWebSocketFactory() {
  const instances: MockWebSocket[] = [];
  
  const factory = function(url: string) {
    const ws = new MockWebSocket(url);
    instances.push(ws);
    return ws as unknown as WebSocket;
  }
  
  return {
    factory,
    getInstances: () => instances,
    clear: () => { instances.length = 0; }
  };
}
