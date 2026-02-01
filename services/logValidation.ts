import { LogEntry, LogLevel, JsonValue } from '../types';

const isObject = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const isLogLevel = (value: unknown): value is LogLevel => {
  return value === LogLevel.DEBUG ||
    value === LogLevel.INFO ||
    value === LogLevel.WARN ||
    value === LogLevel.ERROR;
};

const isValidTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  return !Number.isNaN(Date.parse(value));
};

const isJsonValue = (value: unknown, depth: number = 0): value is JsonValue => {
  if (depth > 20) return false;
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(item => isJsonValue(item, depth + 1));
  }
  if (isObject(value)) {
    return Object.values(value).every(item => isJsonValue(item, depth + 1));
  }
  return false;
};

export const normalizeLogEntry = (value: unknown): LogEntry | null => {
  if (!isObject(value)) return null;

  const entry = value as Record<string, unknown>;

  if (typeof entry.id !== 'string' || entry.id.length === 0) return null;
  if (!isValidTimestamp(entry.timestamp)) return null;
  if (!isLogLevel(entry.level)) return null;
  if (!Array.isArray(entry.args) || !entry.args.every(arg => isJsonValue(arg))) return null;
  if (!isObject(entry.metadata)) return null;

  if ('stacktrace' in entry && entry.stacktrace !== undefined && entry.stacktrace !== null && typeof entry.stacktrace !== 'string') {
    return null;
  }
  if ('source' in entry && entry.source !== undefined && entry.source !== null && typeof entry.source !== 'string') {
    return null;
  }

  const metadata = entry.metadata as Record<string, unknown>;
  if ('file' in metadata && metadata.file !== undefined && metadata.file !== null && typeof metadata.file !== 'string') return null;
  if ('line' in metadata && metadata.line !== undefined && metadata.line !== null && typeof metadata.line !== 'number') return null;
  if ('func' in metadata && metadata.func !== undefined && metadata.func !== null && typeof metadata.func !== 'string') return null;
  if ('lang' in metadata && metadata.lang !== undefined && metadata.lang !== null && typeof metadata.lang !== 'string') return null;
  if ('service' in metadata && metadata.service !== undefined && metadata.service !== null && typeof metadata.service !== 'string') return null;

  return entry as LogEntry;
};
