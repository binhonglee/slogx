import { test, expect } from '@playwright/test';
import path from 'node:path';
import { SDKS, ensureCleanFile, runSdkCi } from './helpers/sdkHarness';

test.describe('SDK Replay Integration', () => {
  test.setTimeout(180000);
  test.describe.configure({ mode: 'serial' });

  const files: Record<string, string> = {};

  test.beforeAll(async () => {
    for (const sdk of SDKS) {
      const filePath = path.join(process.cwd(), 'slogx_logs', `e2e-${sdk.id}.ndjson`);
      await ensureCleanFile(filePath);
      await runSdkCi(`${sdk.name} CI`, sdk.ciCommand(filePath), filePath, 120000);
      files[sdk.id] = filePath;
    }
  });

  for (const sdk of SDKS) {
    test(`replays ${sdk.name} NDJSON`, async ({ page }) => {
      await page.goto('/replay.html');

      const filePath = files[sdk.id];
      await page.setInputFiles('input[type="file"]', filePath);

      await expect(page.locator('.file-info-header')).toContainText(path.basename(filePath));
      await expect(page.getByText(sdk.ciMessage).first()).toBeVisible({ timeout: 15000 });
    });
  }
});
