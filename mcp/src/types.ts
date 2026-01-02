// Log levels matching slogx SDK
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Full log entry as received from slogx WebSocket
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  args: unknown[];
  stacktrace?: string;
  metadata: {
    file?: string;
    line?: number;
    func?: string;
    lang?: string;
    service: string;
  };
}

// Compact log for list responses (token-efficient)
export interface CompactLog {
  id: string;
  content: string; // "timestamp::level::message::service::file:line"
}

// Connection status
export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

// Connection info for slogx_list response
export interface ConnectionInfo {
  url: string;
  status: ConnectionStatus;
  service: string | null;
  log_count: number;
  last_log_at: string | null;
}

// Tool response types
export interface ListResponse {
  connections: ConnectionInfo[];
}

export interface ConnectResponse {
  success: boolean;
  message: string;
}

export interface DisconnectResponse {
  success: boolean;
  message: string;
}

export interface SearchResponse {
  logs: CompactLog[];
  total_matches: number;
}

export interface LogsResponse {
  logs: CompactLog[];
}

export interface DetailsResponse {
  id: string;
  timestamp: string;
  level: LogLevel;
  args: unknown[];
  stacktrace?: string;
  metadata: {
    file?: string;
    line?: number;
    func?: string;
    service: string;
  };
}

// Helper to convert LogEntry to CompactLog
export function toCompactLog(entry: LogEntry): CompactLog {
  const time = entry.timestamp.split('T')[1]?.replace('Z', '') || entry.timestamp;
  const message = formatArgs(entry.args);
  const file = entry.metadata.file || 'unknown';
  const line = entry.metadata.line || 0;
  const service = entry.metadata.service || 'unknown';

  return {
    id: entry.id,
    content: `${time}::${entry.level}::${message}::${service}::${file}:${line}`
  };
}

// Format args array into a readable message string
function formatArgs(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') {
      try {
        // For errors, extract message
        if ('message' in (arg as object)) {
          return (arg as { message: string }).message;
        }
        return JSON.stringify(arg);
      } catch {
        return '[object]';
      }
    }
    return String(arg);
  }).join(' ');
}
