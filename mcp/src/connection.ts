import WebSocket from 'ws';
import { LogEntry, ConnectionStatus, ConnectionInfo, CompactLog, toCompactLog } from './types.js';

const MAX_BUFFER_SIZE = 500;

export class SlogxConnection {
  public url: string;
  public status: ConnectionStatus = 'disconnected';
  public service: string | null = null;
  public lastLogAt: string | null = null;

  private ws: WebSocket | null = null;
  private buffer: LogEntry[] = [];
  private logIndex: Map<string, LogEntry> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.status === 'connected' || this.status === 'connecting') {
        resolve();
        return;
      }

      this.status = 'connecting';

      try {
        this.ws = new WebSocket(this.url);

        this.ws.on('open', () => {
          this.status = 'connected';
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('close', () => {
          this.status = 'disconnected';
          this.ws = null;
        });

        this.ws.on('error', (err) => {
          const wasConnecting = this.status === 'connecting';
          this.status = 'disconnected';
          this.ws = null;
          if (wasConnecting) {
            reject(new Error(`Failed to connect: ${err.message}`));
          }
        });

        // Timeout for connection
        setTimeout(() => {
          if (this.status === 'connecting') {
            this.ws?.close();
            this.status = 'disconnected';
            reject(new Error('Connection timeout'));
          }
        }, 5000);

      } catch (err) {
        this.status = 'disconnected';
        reject(err);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = 'disconnected';
  }

  private handleMessage(data: WebSocket.Data): void {
    try {
      const text = data.toString();
      const parsed = JSON.parse(text);

      // Handle both single entry and array of entries
      const entries: LogEntry[] = Array.isArray(parsed) ? parsed : [parsed];

      for (const entry of entries) {
        if (this.isValidLogEntry(entry)) {
          this.addLog(entry);

          // Capture service name from first log
          if (!this.service && entry.metadata?.service) {
            this.service = entry.metadata.service;
          }

          this.lastLogAt = entry.timestamp;
        }
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private isValidLogEntry(entry: unknown): entry is LogEntry {
    if (typeof entry !== 'object' || entry === null) return false;
    const e = entry as Record<string, unknown>;
    return (
      typeof e.id === 'string' &&
      typeof e.timestamp === 'string' &&
      typeof e.level === 'string' &&
      Array.isArray(e.args)
    );
  }

  private addLog(entry: LogEntry): void {
    // Remove oldest if at capacity
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      const removed = this.buffer.shift();
      if (removed) {
        this.logIndex.delete(removed.id);
      }
    }

    this.buffer.push(entry);
    this.logIndex.set(entry.id, entry);
  }

  getInfo(): ConnectionInfo {
    return {
      url: this.url,
      status: this.status,
      service: this.service,
      log_count: this.buffer.length,
      last_log_at: this.lastLogAt
    };
  }

  getLogById(id: string): LogEntry | undefined {
    return this.logIndex.get(id);
  }

  getLogs(level?: string, limit: number = 20): CompactLog[] {
    let logs = [...this.buffer].reverse(); // Most recent first

    if (level) {
      logs = logs.filter(l => l.level === level);
    }

    return logs.slice(0, limit).map(toCompactLog);
  }

  getErrors(limit: number = 20): CompactLog[] {
    return this.getLogs('ERROR', limit);
  }

  search(query: string, level?: string, limit: number = 20): { logs: CompactLog[], total: number } {
    const lowerQuery = query.toLowerCase();
    let matches = [...this.buffer].reverse().filter(entry => {
      // Search in args
      const argsStr = JSON.stringify(entry.args).toLowerCase();
      if (argsStr.includes(lowerQuery)) return true;

      // Search in metadata
      if (entry.metadata.file?.toLowerCase().includes(lowerQuery)) return true;
      if (entry.metadata.func?.toLowerCase().includes(lowerQuery)) return true;
      if (entry.metadata.service?.toLowerCase().includes(lowerQuery)) return true;

      // Search in stacktrace
      if (entry.stacktrace?.toLowerCase().includes(lowerQuery)) return true;

      return false;
    });

    if (level) {
      matches = matches.filter(l => l.level === level);
    }

    const total = matches.length;
    const logs = matches.slice(0, limit).map(toCompactLog);

    return { logs, total };
  }
}

// Manager for multiple connections
export class ConnectionManager {
  private connections: Map<string, SlogxConnection> = new Map();

  async connect(url: string): Promise<{ success: boolean; message: string }> {
    // Normalize URL
    const normalizedUrl = this.normalizeUrl(url);

    if (this.connections.has(normalizedUrl)) {
      const conn = this.connections.get(normalizedUrl)!;
      if (conn.status === 'connected') {
        return { success: true, message: `Already connected to ${normalizedUrl}` };
      }
    }

    const conn = new SlogxConnection(normalizedUrl);
    this.connections.set(normalizedUrl, conn);

    try {
      await conn.connect();
      return { success: true, message: `Connected to ${normalizedUrl}` };
    } catch (err) {
      this.connections.delete(normalizedUrl);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, message: `Failed to connect to ${normalizedUrl}: ${msg}` };
    }
  }

  disconnect(url: string): { success: boolean; message: string } {
    const normalizedUrl = this.normalizeUrl(url);
    const conn = this.connections.get(normalizedUrl);

    if (!conn) {
      return { success: false, message: `No connection found for ${normalizedUrl}` };
    }

    conn.disconnect();
    this.connections.delete(normalizedUrl);
    return { success: true, message: `Disconnected from ${normalizedUrl}` };
  }

  list(): ConnectionInfo[] {
    return Array.from(this.connections.values()).map(c => c.getInfo());
  }

  getLogById(id: string): LogEntry | undefined {
    for (const conn of this.connections.values()) {
      const entry = conn.getLogById(id);
      if (entry) return entry;
    }
    return undefined;
  }

  getLogs(service?: string, level?: string, limit: number = 20): CompactLog[] {
    const allLogs: CompactLog[] = [];

    for (const conn of this.connections.values()) {
      if (service && conn.service !== service) continue;
      allLogs.push(...conn.getLogs(level, limit));
    }

    // Sort by timestamp (most recent first) and limit
    return allLogs
      .sort((a, b) => b.content.localeCompare(a.content))
      .slice(0, limit);
  }

  getErrors(service?: string, limit: number = 20): CompactLog[] {
    return this.getLogs(service, 'ERROR', limit);
  }

  search(query: string, service?: string, level?: string, limit: number = 20): { logs: CompactLog[], total: number } {
    let allLogs: CompactLog[] = [];
    let totalMatches = 0;

    for (const conn of this.connections.values()) {
      if (service && conn.service !== service) continue;
      const result = conn.search(query, level, limit);
      allLogs.push(...result.logs);
      totalMatches += result.total;
    }

    // Sort and limit
    const logs = allLogs
      .sort((a, b) => b.content.localeCompare(a.content))
      .slice(0, limit);

    return { logs, total: totalMatches };
  }

  private normalizeUrl(url: string): string {
    // Handle common variations
    let normalized = url.trim();

    // Add ws:// if no protocol
    if (!normalized.startsWith('ws://') && !normalized.startsWith('wss://')) {
      if (normalized.startsWith('http://')) {
        normalized = normalized.replace('http://', 'ws://');
      } else if (normalized.startsWith('https://')) {
        normalized = normalized.replace('https://', 'wss://');
      } else {
        normalized = `ws://${normalized}`;
      }
    }

    return normalized;
  }
}
