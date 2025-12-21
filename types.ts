export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export interface LogMetadata {
  file?: string;
  line?: number;
  func?: string;
  lang?: 'go' | 'python' | 'node' | 'ruby';
  service?: string;
}

// JSON-serializable primitive types
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface LogEntry {
  id: string;
  timestamp: string; // ISO string
  level: LogLevel;
  args: JsonValue[]; // The raw arguments passed to slogx()
  stacktrace?: string; // Full call stack
  metadata: LogMetadata;
  source?: string; // WebSocket URL this log came from
}

export interface FilterState {
  search: string;
  levels: Set<LogLevel>;
  paused: boolean;
}