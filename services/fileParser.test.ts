import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseNDJSON } from './fileParser';

describe('parseNDJSON', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => { });
    });

    const createFile = (content: string, name = 'test.ndjson') => {
        return new File([content], name, { type: 'application/x-ndjson' });
    };

    it('parses valid NDJSON with multiple entries', async () => {
        const content = [
            '{"id":"1","timestamp":"2024-01-01T10:00:00Z","level":"INFO","args":["msg1"],"metadata":{}}',
            '{"id":"2","timestamp":"2024-01-01T10:00:01Z","level":"WARN","args":["msg2"],"metadata":{}}'
        ].join('\n');

        const file = createFile(content);
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(2);
        expect(result[0].level).toBe('INFO');
        expect(result[1].level).toBe('WARN');
    });

    it('returns empty array for empty file', async () => {
        const file = createFile('');
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(0);
    });

    it('skips empty lines', async () => {
        const content = [
            '{"id":"1","timestamp":"2024-01-01T10:00:00Z","level":"INFO","args":["msg1"],"metadata":{}}',
            '',
            '   ',
            '{"id":"2","timestamp":"2024-01-01T10:00:01Z","level":"ERROR","args":["msg2"],"metadata":{}}'
        ].join('\n');

        const file = createFile(content);
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(2);
    });

    it('skips malformed JSON lines and continues parsing', async () => {
        const content = [
            '{"id":"1","timestamp":"2024-01-01T10:00:00Z","level":"INFO","args":["valid"],"metadata":{}}',
            'this is not json',
            '{"id":"2","timestamp":"2024-01-01T10:00:01Z","level":"ERROR","args":["also valid"],"metadata":{}}'
        ].join('\n');

        const file = createFile(content);
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(2);
        expect(console.warn).toHaveBeenCalled();
    });

    it('skips entries missing required fields (id, timestamp, level, args, metadata)', async () => {
        const content = [
            '{"id":"1","timestamp":"2024-01-01T10:00:00Z","level":"INFO","args":["valid"],"metadata":{}}',
            '{"id":"2","level":"INFO","args":["missing timestamp"],"metadata":{}}',
            '{"id":"3","timestamp":"2024-01-01T10:00:01Z","args":["missing level"],"metadata":{}}',
            '{"timestamp":"2024-01-01T10:00:02Z","level":"WARN","args":["missing id"],"metadata":{}}',
            '{"id":"4","timestamp":"2024-01-01T10:00:03Z","level":"WARN","metadata":{}}',
            '{"id":"5","timestamp":"2024-01-01T10:00:04Z","level":"WARN","args":["also valid"],"metadata":{}}'
        ].join('\n');

        const file = createFile(content);
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(2);
        expect(result[0].args).toEqual(['valid']);
        expect(result[1].args).toEqual(['also valid']);
    });

    it('adds source field with filename to each entry', async () => {
        const content = '{"id":"1","timestamp":"2024-01-01T10:00:00Z","level":"INFO","args":["msg"],"metadata":{}}';

        const file = createFile(content, 'my-logs.ndjson');
        const result = await parseNDJSON(file);

        expect(result[0].source).toBe('my-logs.ndjson');
    });

    it('handles file with only whitespace', async () => {
        const file = createFile('   \n\n   \n');
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(0);
    });

    it('handles file with trailing newline', async () => {
        const content = '{"id":"1","timestamp":"2024-01-01T10:00:00Z","level":"INFO","args":["msg"],"metadata":{}}\n';

        const file = createFile(content);
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(1);
    });

    it('handles entries with extra fields gracefully', async () => {
        const content = '{"id":"1","timestamp":"2024-01-01T10:00:00Z","level":"INFO","args":["msg"],"metadata":{},"extra":"field","another":123}';

        const file = createFile(content);
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(1);
        expect((result[0] as any).extra).toBe('field');
    });

    it('skips objects that are not valid log entries (non-object JSON)', async () => {
        const content = [
            '"just a string"',
            '123',
            'null',
            '{"id":"1","timestamp":"2024-01-01T10:00:00Z","level":"INFO","args":["valid"],"metadata":{}}'
        ].join('\n');

        const file = createFile(content);
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(1);
        expect(result[0].args).toEqual(['valid']);
    });

    it('handles arrays as valid JSON but not as log entries', async () => {
        const content = [
            '[1, 2, 3]',
            '{"id":"1","timestamp":"2024-01-01T10:00:00Z","level":"INFO","args":["valid"],"metadata":{}}'
        ].join('\n');

        const file = createFile(content);
        const result = await parseNDJSON(file);

        expect(result).toHaveLength(1);
        expect(result[0].args).toEqual(['valid']);
    });

});
