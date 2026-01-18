import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CIWriter } from './ciWriter';
import * as fs from 'fs';
import * as path from 'path';

describe('CIWriter', () => {
    const testDir = './test-logs';
    const testFile = path.join(testDir, 'test.ndjson');

    beforeEach(() => {
        // Clear test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        // Cleanup
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });

    it('creates directory if it does not exist', () => {
        const nestedPath = path.join(testDir, 'nested', 'deep', 'logs.ndjson');
        const writer = new CIWriter(nestedPath);
        writer.close();

        expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);
    });

    it('creates empty file on initialization', () => {
        const writer = new CIWriter(testFile);
        writer.close();

        expect(fs.existsSync(testFile)).toBe(true);
        expect(fs.readFileSync(testFile, 'utf-8')).toBe('');
    });

    it('writes entries to buffer', () => {
        const writer = new CIWriter(testFile);
        writer.write({ msg: 'test' });

        // Before flush, file should be empty
        expect(fs.readFileSync(testFile, 'utf-8')).toBe('');

        writer.close();

        // After close, entry should be written
        const content = fs.readFileSync(testFile, 'utf-8');
        expect(content).toContain('test');
    });

    it('flushes buffer on interval', () => {
        const writer = new CIWriter(testFile);
        writer.write({ msg: 'test1' });
        writer.write({ msg: 'test2' });

        // Advance timer by 500ms (flush interval)
        vi.advanceTimersByTime(500);

        const content = fs.readFileSync(testFile, 'utf-8');
        expect(content).toContain('test1');
        expect(content).toContain('test2');

        writer.close();
    });

    it('enforces rolling window by trimming oldest entries', () => {
        const maxEntries = 5;
        const writer = new CIWriter(testFile, maxEntries);

        // Write more entries than maxEntries
        for (let i = 0; i < 10; i++) {
            writer.write({ id: i });
        }

        writer.close();

        const content = fs.readFileSync(testFile, 'utf-8');
        const lines = content.trim().split('\n');

        // Should only have last 5 entries
        expect(lines.length).toBe(maxEntries);

        const parsed = lines.map(l => JSON.parse(l));
        expect(parsed[0].id).toBe(5); // First entry should be id=5 (0-4 trimmed)
        expect(parsed[4].id).toBe(9); // Last entry should be id=9
    });

    it('forces flush when buffer exceeds 1.5x maxEntries', () => {
        const maxEntries = 10;
        const writer = new CIWriter(testFile, maxEntries);

        // Write enough to trigger forced flush (1.5x = 15 entries)
        for (let i = 0; i < 16; i++) {
            writer.write({ id: i });
        }

        // Should have auto-flushed without waiting for timer
        const content = fs.readFileSync(testFile, 'utf-8');
        expect(content.length).toBeGreaterThan(0);

        writer.close();
    });

    it('does not write after close', () => {
        const writer = new CIWriter(testFile);
        writer.write({ msg: 'before' });
        writer.close();

        const beforeContent = fs.readFileSync(testFile, 'utf-8');

        writer.write({ msg: 'after' });

        const afterContent = fs.readFileSync(testFile, 'utf-8');

        // Content should not change after close
        expect(afterContent).toBe(beforeContent);
        expect(afterContent).not.toContain('after');
    });

    it('tracks entry count', () => {
        const writer = new CIWriter(testFile);

        expect(writer.getEntryCount()).toBe(0);

        writer.write({ msg: '1' });
        writer.write({ msg: '2' });
        writer.write({ msg: '3' });

        expect(writer.getEntryCount()).toBe(3);

        writer.close();
    });

    it('handles empty writes gracefully', () => {
        const writer = new CIWriter(testFile);
        writer.flush(); // Flush with empty buffer should not error
        writer.close();

        expect(fs.readFileSync(testFile, 'utf-8')).toBe('');
    });

    it('clears existing file on new instance', () => {
        // Write some content first
        fs.mkdirSync(testDir, { recursive: true });
        fs.writeFileSync(testFile, 'old content\n');

        const writer = new CIWriter(testFile);
        writer.close();

        expect(fs.readFileSync(testFile, 'utf-8')).toBe('');
    });
});
