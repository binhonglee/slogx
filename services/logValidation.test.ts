import { describe, it, expect } from 'vitest';
import { normalizeLogEntry } from './logValidation';

const baseEntry = {
  id: '1',
  timestamp: '2024-01-01T10:00:00Z',
  level: 'INFO',
  args: ['hello'],
  metadata: {
    file: 'test.ts',
    line: 10,
    func: 'fn',
    lang: 'node',
    service: 'svc'
  }
};

describe('normalizeLogEntry', () => {
  it('accepts a valid log entry', () => {
    const result = normalizeLogEntry(baseEntry);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('1');
  });

  it('rejects invalid timestamp', () => {
    const result = normalizeLogEntry({ ...baseEntry, timestamp: 'nope' });
    expect(result).toBeNull();
  });

  it('rejects invalid level', () => {
    const result = normalizeLogEntry({ ...baseEntry, level: 'TRACE' });
    expect(result).toBeNull();
  });

  it('rejects non-array args', () => {
    const result = normalizeLogEntry({ ...baseEntry, args: 'nope' });
    expect(result).toBeNull();
  });

  it('rejects invalid metadata types', () => {
    const result = normalizeLogEntry({
      ...baseEntry,
      metadata: { file: 123 }
    });
    expect(result).toBeNull();
  });
});
