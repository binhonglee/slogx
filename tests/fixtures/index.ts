import { LogEntry, LogLevel, FilterState } from '../../types';

export function createLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    args: ['Test log message'],
    metadata: {
      lang: 'node',
      service: 'test-service'
    },
    ...overrides
  };
}

export function createFilterState(overrides: Partial<FilterState> = {}): FilterState {
  return {
    search: '',
    levels: new Set([LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]),
    paused: false,
    ...overrides
  };
}

export function createLogBatch(count: number, overrides: Partial<LogEntry> = {}): LogEntry[] {
  return Array.from({ length: count }, () => createLogEntry(overrides));
}
