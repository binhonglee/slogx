import { describe, it, expect } from 'vitest';
import { normalizeLogEntry } from '../../services/logValidation';
import { createLogEntry } from '../fixtures';
import { LogLevel } from '../../types';

describe('SDK -> Frontend Validation Flow', () => {
  it('validates a standard log entry from SDK', () => {
    // Simulating SDK JSON output
    const rawSdkLog = {
      id: 'sdk-12345',
      timestamp: new Date().toISOString(),
      level: 'INFO',
      args: ['User logged in', { userId: 42, ip: '127.0.0.1' }],
      metadata: {
        file: '/src/auth.ts',
        line: 120,
        lang: 'node',
        service: 'auth-service'
      }
    };
    
    const result = normalizeLogEntry(rawSdkLog);
    expect(result).not.toBeNull();
    expect(result?.id).toBe('sdk-12345');
    expect(result?.level).toBe('INFO');
  });

  it('rejects malformed entries', () => {
    const invalidLog = {
      id: 'sdk-123',
      timestamp: 'not-a-date',
      level: 'INFO',
      args: [],
      metadata: {}
    };
    
    const result = normalizeLogEntry(invalidLog);
    expect(result).toBeNull();
  });

  it('serializes invalid nested depths using function type args correctly', () => {
    const invalidArgsLog = {
      id: 'sdk-err',
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      args: [() => {}], // functions are not JSON serializable natively
      metadata: {}
    };
    
    const result = normalizeLogEntry(invalidArgsLog);
    expect(result).toBeNull();
  });

  it('handles edge cases: empty args, sparse metadata', () => {
    const edgeCaseLog = {
      id: 'sdk-edge',
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      args: [], // perfectly valid to have no args sometimes
      metadata: {
        service: 'minimum-service'
      }
    };
    
    const result = normalizeLogEntry(edgeCaseLog);
    expect(result).not.toBeNull();
    expect(result?.args).toEqual([]);
    expect(result?.metadata.service).toBe('minimum-service');
  });
});
