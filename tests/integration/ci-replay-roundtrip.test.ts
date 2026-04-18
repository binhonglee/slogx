import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CIWriter } from '../../sdk/ts/ciWriter';
import { parseNDJSON } from '../../services/fileParser';
import { LogLevel } from '../../types';

describe('CI Replay Roundtrip', () => {
  const testDir = path.join(os.tmpdir(), 'slogx-test-roundtrip');
  const maxEntries = 100;

  afterEach(() => {
    // Cleanup any temporary files created during this test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('preserves data integrity between CIWriter and fileParser', async () => {
    const filePath = path.join(testDir, 'test-roundtrip.slogx');
    
    // 1. Write the logs using CIWriter
    const writer = new CIWriter(filePath, maxEntries);
    
    const logsToWrite = [
      {
        id: 'rd-1',
        timestamp: new Date().toISOString(),
        level: LogLevel.INFO,
        args: ['Log number 1', { detail: 'value1' }],
        metadata: { service: 'test-service', file: 'app.ts', line: 1 }
      },
      {
        id: 'rd-2',
        timestamp: new Date().toISOString(),
        level: LogLevel.ERROR,
        args: ['Log number 2'],
        metadata: { service: 'test-service' }
      }
    ];

    logsToWrite.forEach(log => writer.write(log));
    
    // Force write buffer to flush
    writer.close();
    
    // 2. Simulate reading back with FileReader/fileParser
    expect(fs.existsSync(filePath)).toBe(true);
    
    // Parse it back exactly as the browser would (from a File object or blob, but we use string parsing via mock for now)
    // The parser takes a fetch Response or string content conceptually? Let's check what `parseNDJSON` takes.
    // Assuming `parseNDJSON` takes a `File` object. In Node, we can mock `File`.
    const fileContent = fs.readFileSync(filePath);
    const mockFile = new File([fileContent], 'test-roundtrip.slogx', { type: 'application/x-ndjson' });
    
    const readLogs = await parseNDJSON(mockFile);
    
    // 3. Verify exactly matching
    expect(readLogs).toHaveLength(2);
    expect(readLogs[0].id).toBe('rd-1');
    expect(readLogs[0].level).toBe(LogLevel.INFO);
    expect(readLogs[0].args[1]).toEqual({ detail: 'value1' });
    
    expect(readLogs[1].id).toBe('rd-2');
    expect(readLogs[1].level).toBe(LogLevel.ERROR);
  });
});
