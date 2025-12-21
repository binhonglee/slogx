import { describe, it, expect } from 'vitest';
import { generateMockLog } from './mockService';
import { LogLevel } from '../types';

describe('generateMockLog', () => {
  it('returns a valid log entry structure', () => {
    const log = generateMockLog();

    expect(log).toHaveProperty('id');
    expect(log).toHaveProperty('timestamp');
    expect(log).toHaveProperty('level');
    expect(log).toHaveProperty('args');
    expect(log).toHaveProperty('metadata');
  });

  it('generates a valid UUID', () => {
    const log = generateMockLog();
    // crypto.randomUUID() format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(log.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates a valid ISO timestamp', () => {
    const log = generateMockLog();
    const parsed = new Date(log.timestamp);
    expect(parsed.toString()).not.toBe('Invalid Date');
  });

  it('uses valid log levels', () => {
    const validLevels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];

    // Generate multiple logs to cover different levels
    for (let i = 0; i < 50; i++) {
      const log = generateMockLog();
      expect(validLevels).toContain(log.level);
    }
  });

  it('always has at least one arg', () => {
    for (let i = 0; i < 20; i++) {
      const log = generateMockLog();
      expect(log.args.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('includes proper metadata', () => {
    const log = generateMockLog();

    expect(log.metadata).toHaveProperty('file');
    expect(log.metadata).toHaveProperty('line');
    expect(log.metadata).toHaveProperty('lang');
    expect(log.metadata).toHaveProperty('service');

    expect(['go', 'python']).toContain(log.metadata.lang);
    expect(log.metadata.service).toBe('demo-service');
    expect(typeof log.metadata.line).toBe('number');
  });

  it('generates stacktraces for error logs', () => {
    // Generate enough logs to get some errors
    const logs = Array.from({ length: 100 }, () => generateMockLog());
    const errorLogs = logs.filter(l => l.level === LogLevel.ERROR);

    // All error logs should have stacktraces
    for (const log of errorLogs) {
      expect(log.stacktrace).toBeDefined();
      expect(typeof log.stacktrace).toBe('string');
      expect(log.stacktrace!.length).toBeGreaterThan(0);
    }
  });
});
