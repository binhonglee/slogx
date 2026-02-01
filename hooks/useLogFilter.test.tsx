import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/preact';
import { useLogFilter } from './useLogFilter';
import { LogEntry, LogLevel, FilterState } from '../types';

const makeLog = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  id: '1',
  timestamp: '2024-01-01T00:00:00.000Z',
  level: LogLevel.INFO,
  args: ['hello world'],
  metadata: {},
  ...overrides
});

const allLevels = new Set([LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]);

const makeFilter = (overrides: Partial<FilterState> = {}): FilterState => ({
  search: '',
  levels: allLevels,
  paused: false,
  ...overrides
});

describe('useLogFilter', () => {
  it('returns all logs when filter is empty', () => {
    const logs = [
      makeLog({ id: '1' }),
      makeLog({ id: '2' }),
      makeLog({ id: '3' })
    ];
    const filter = makeFilter();

    const { result } = renderHook(() => useLogFilter(logs, filter));

    expect(result.current).toHaveLength(3);
  });

  it('filters by log level', () => {
    const logs = [
      makeLog({ id: '1', level: LogLevel.DEBUG }),
      makeLog({ id: '2', level: LogLevel.INFO }),
      makeLog({ id: '3', level: LogLevel.WARN }),
      makeLog({ id: '4', level: LogLevel.ERROR })
    ];
    const filter = makeFilter({ levels: new Set([LogLevel.WARN, LogLevel.ERROR]) });

    const { result } = renderHook(() => useLogFilter(logs, filter));

    expect(result.current).toHaveLength(2);
    expect(result.current.map(l => l.id)).toEqual(['3', '4']);
  });

  it('filters by search text in args', () => {
    const logs = [
      makeLog({ id: '1', args: ['user logged in'] }),
      makeLog({ id: '2', args: ['database error'] }),
      makeLog({ id: '3', args: ['user logged out'] })
    ];
    const filter = makeFilter({ search: 'user' });

    const { result } = renderHook(() => useLogFilter(logs, filter));

    expect(result.current).toHaveLength(2);
    expect(result.current.map(l => l.id)).toEqual(['1', '3']);
  });

  it('filters by search text in metadata file', () => {
    const logs = [
      makeLog({ id: '1', metadata: { file: 'auth.ts' } }),
      makeLog({ id: '2', metadata: { file: 'database.ts' } }),
      makeLog({ id: '3', metadata: { file: 'auth-utils.ts' } })
    ];
    const filter = makeFilter({ search: 'auth' });

    const { result } = renderHook(() => useLogFilter(logs, filter));

    expect(result.current).toHaveLength(2);
    expect(result.current.map(l => l.id)).toEqual(['1', '3']);
  });

  it('filters by search text in metadata service', () => {
    const logs = [
      makeLog({ id: '1', metadata: { service: 'auth-service' } }),
      makeLog({ id: '2', metadata: { service: 'payment-service' } }),
      makeLog({ id: '3', metadata: { service: 'auth-worker' } })
    ];
    const filter = makeFilter({ search: 'auth' });

    const { result } = renderHook(() => useLogFilter(logs, filter));

    expect(result.current).toHaveLength(2);
    expect(result.current.map(l => l.id)).toEqual(['1', '3']);
  });

  it('search is case insensitive', () => {
    const logs = [
      makeLog({ id: '1', args: ['USER logged in'] }),
      makeLog({ id: '2', args: ['database error'] })
    ];
    const filter = makeFilter({ search: 'user' });

    const { result } = renderHook(() => useLogFilter(logs, filter));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('1');
  });

  it('filters out hidden sources', () => {
    const logs = [
      makeLog({ id: '1', source: 'ws://localhost:8080' }),
      makeLog({ id: '2', source: 'ws://localhost:8081' }),
      makeLog({ id: '3', source: 'ws://localhost:8080' })
    ];
    const filter = makeFilter();
    const hiddenSources = new Set(['ws://localhost:8080']);

    const { result } = renderHook(() => useLogFilter(logs, filter, hiddenSources));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('2');
  });

  it('combines level and search filters', () => {
    const logs = [
      makeLog({ id: '1', level: LogLevel.DEBUG, args: ['user debug'] }),
      makeLog({ id: '2', level: LogLevel.INFO, args: ['user info'] }),
      makeLog({ id: '3', level: LogLevel.ERROR, args: ['user error'] }),
      makeLog({ id: '4', level: LogLevel.INFO, args: ['other info'] })
    ];
    const filter = makeFilter({
      levels: new Set([LogLevel.INFO, LogLevel.ERROR]),
      search: 'user'
    });

    const { result } = renderHook(() => useLogFilter(logs, filter));

    expect(result.current).toHaveLength(2);
    expect(result.current.map(l => l.id)).toEqual(['2', '3']);
  });

  it('searches in nested object args', () => {
    const logs = [
      makeLog({ id: '1', args: [{ user: { name: 'alice' } }] }),
      makeLog({ id: '2', args: [{ user: { name: 'bob' } }] })
    ];
    const filter = makeFilter({ search: 'alice' });

    const { result } = renderHook(() => useLogFilter(logs, filter));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe('1');
  });

  it('returns empty array when all logs filtered out', () => {
    const logs = [
      makeLog({ id: '1', level: LogLevel.DEBUG }),
      makeLog({ id: '2', level: LogLevel.DEBUG })
    ];
    const filter = makeFilter({ levels: new Set([LogLevel.ERROR]) });

    const { result } = renderHook(() => useLogFilter(logs, filter));

    expect(result.current).toHaveLength(0);
  });
});
