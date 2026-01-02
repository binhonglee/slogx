import { describe, it, expect } from 'vitest';
import { toCompactLog, LogEntry } from './types.js';

describe('toCompactLog', () => {
  it('converts a log entry to compact format', () => {
    const entry: LogEntry = {
      id: 'test-123',
      timestamp: '2025-01-15T10:30:45.123Z',
      level: 'ERROR',
      args: ['Payment failed', { reason: 'timeout' }],
      metadata: {
        file: 'payment.ts',
        line: 42,
        func: 'processPayment',
        service: 'checkout'
      }
    };

    const compact = toCompactLog(entry);

    expect(compact.id).toBe('test-123');
    expect(compact.content).toContain('ERROR');
    expect(compact.content).toContain('Payment failed');
    expect(compact.content).toContain('checkout');
    expect(compact.content).toContain('payment.ts:42');
  });

  it('handles string args', () => {
    const entry: LogEntry = {
      id: 'test-1',
      timestamp: '2025-01-15T10:30:45.123Z',
      level: 'INFO',
      args: ['Server started'],
      metadata: { service: 'api' }
    };

    const compact = toCompactLog(entry);
    expect(compact.content).toContain('Server started');
  });

  it('handles object args', () => {
    const entry: LogEntry = {
      id: 'test-2',
      timestamp: '2025-01-15T10:30:45.123Z',
      level: 'DEBUG',
      args: [{ user: 'alice', action: 'login' }],
      metadata: { service: 'auth' }
    };

    const compact = toCompactLog(entry);
    expect(compact.content).toContain('user');
    expect(compact.content).toContain('alice');
  });

  it('handles error objects with message property', () => {
    const entry: LogEntry = {
      id: 'test-3',
      timestamp: '2025-01-15T10:30:45.123Z',
      level: 'ERROR',
      args: [{ message: 'Connection refused', name: 'Error' }],
      metadata: { service: 'db' }
    };

    const compact = toCompactLog(entry);
    expect(compact.content).toContain('Connection refused');
  });

  it('handles null and undefined args', () => {
    const entry: LogEntry = {
      id: 'test-4',
      timestamp: '2025-01-15T10:30:45.123Z',
      level: 'WARN',
      args: [null, undefined, 'value'],
      metadata: { service: 'app' }
    };

    const compact = toCompactLog(entry);
    expect(compact.content).toContain('null');
    expect(compact.content).toContain('undefined');
    expect(compact.content).toContain('value');
  });

  it('handles missing file and line in metadata', () => {
    const entry: LogEntry = {
      id: 'test-5',
      timestamp: '2025-01-15T10:30:45.123Z',
      level: 'INFO',
      args: ['test'],
      metadata: { service: 'app' }
    };

    const compact = toCompactLog(entry);
    expect(compact.content).toContain('unknown:0');
  });
});
