import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const LOG_DIR = './slogx_logs';
const TEST_LOG_FILE = 'e2e-test-service.ndjson';
const FULL_LOG_PATH = path.join(LOG_DIR, TEST_LOG_FILE);

test.describe('CI Replay Flow', () => {
    // Test Data
    const timestamp = new Date().toISOString();
    const testLog = {
        id: 'test-uuid-123',
        timestamp,
        level: 'INFO',
        args: ['E2E Test Message'],
        metadata: {
            file: 'e2e.ts',
            line: 1,
            func: 'test',
            lang: 'node',
            service: 'e2e-test-service'
        }
    };

    test.beforeAll(() => {
        // 1. Simulate CI Log Generation
        // We manually write a file to mimic the SDK behavior in CI mode
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR);
        }

        // Clear existing file
        if (fs.existsSync(FULL_LOG_PATH)) {
            fs.unlinkSync(FULL_LOG_PATH);
        }

        // Write a few lines of NDJSON
        const entries = [
            { ...testLog, id: '1', level: 'INFO', args: ['First log'] },
            { ...testLog, id: '2', level: 'WARN', args: ['Warning log'] },
            { ...testLog, id: '3', level: 'ERROR', args: ['Error log', { detail: 'something broke' }] }
        ];

        const content = entries.map(e => JSON.stringify(e)).join('\n');
        fs.writeFileSync(FULL_LOG_PATH, content);
        console.log(`Generated test log file at ${FULL_LOG_PATH}`);
    });

    test('should load and display logs in replay mode', async ({ page }) => {
        // 2. Open Replay UI
        await page.goto('/replay.html');
        await expect(page).toHaveTitle(/slogx | Replay/);

        // 3. Upload the generated file using the new FullScreenDropZone component
        // Use drag-and-drop simulation on the dropzone

        // Create a DataTransfer to simulate drag and drop if no input is exposed
        const buffer = fs.readFileSync(FULL_LOG_PATH);

        // We'll use a more robust drag-and-drop simulation
        const dataTransfer = await page.evaluateHandle(({ bufferHex, fileName }) => {
            const dt = new DataTransfer();
            const buffer = new Uint8Array(bufferHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            const file = new File([buffer], fileName, { type: 'application/x-ndjson' });
            dt.items.add(file);
            return dt;
        }, {
            bufferHex: buffer.toString('hex'),
            fileName: TEST_LOG_FILE
        });

        // Dispatch drop event on the drop zone
        await page.dispatchEvent('.fullscreen-dropzone', 'drop', { dataTransfer });

        // Check for file info in header
        await expect(page.locator('.file-info-header')).toContainText(TEST_LOG_FILE);
        await expect(page.locator('.file-info-header')).toContainText('3 events');

        // Check for log content
        await expect(page.getByText('First log')).toBeVisible();
        await expect(page.getByText('Warning log')).toBeVisible();
        await expect(page.getByText('Error log')).toBeVisible();

        // Check styling classes
        await expect(page.locator('.log-item.warn')).toBeVisible();
        await expect(page.locator('.log-item.error')).toBeVisible();
    });

    test('should filter logs', async ({ page }) => {
        // Load file again (state resets on reload unless we persist)
        // For speed, let's just re-upload or chain steps. Re-uploading is safer for test isolation.
        await page.goto('/replay.html');
        const buffer = fs.readFileSync(FULL_LOG_PATH);
        const dataTransfer = await page.evaluateHandle(({ bufferHex, fileName }) => {
            const dt = new DataTransfer();
            const buffer = new Uint8Array(bufferHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            const file = new File([buffer], fileName, { type: 'application/x-ndjson' });
            dt.items.add(file);
            return dt;
        }, {
            bufferHex: buffer.toString('hex'),
            fileName: TEST_LOG_FILE
        });
        await page.dispatchEvent('.fullscreen-dropzone', 'drop', { dataTransfer });

        // Filter by text
        await page.getByPlaceholder('Filter logs (msg, service, file)...').fill('Warning');
        await expect(page.getByText('First log')).not.toBeVisible();
        await expect(page.getByText('Warning log')).toBeVisible();

        // Clear filter
        await page.getByPlaceholder('Filter logs (msg, service, file)...').fill('');
        await expect(page.getByText('First log')).toBeVisible();
    });

    test('should show URL input when Load from URL is clicked', async ({ page }) => {
        await page.goto('/replay.html');

        // Click Load from URL button
        await page.click('button:has-text("Load from URL")');

        // URL input should appear
        await expect(page.getByPlaceholder('https://example.com/logs.ndjson')).toBeVisible();
        await expect(page.getByText('Load', { exact: true })).toBeVisible();

        // Cancel should work
        await page.click('button:has-text("Cancel")');

        // Should be back to default state
        await expect(page.getByText('Browse Files')).toBeVisible();
        await expect(page.getByText('Load from URL')).toBeVisible();
    });
});
