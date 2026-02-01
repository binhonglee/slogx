import { test, expect } from '@playwright/test';
import { SDKS, getAvailablePort, startSdkProcess } from './helpers/sdkHarness';

test.describe('SDK WebSocket Integration', () => {
  test.setTimeout(180000);
  for (const sdk of SDKS) {
    test(`streams logs from ${sdk.name}`, async ({ page }) => {
      const port = await getAvailablePort(0);
      const proc = await startSdkProcess(`${sdk.name} WS`, sdk.wsCommand(port), 30000);
      try {
        await page.goto('/app.html');

        const input = page.locator('.connection-form input');
        await input.fill(`localhost:${port}`);
        await page.locator('.connection-form button').click();

        await expect(
          page.locator('.connection-chip.connected .url', { hasText: `localhost:${port}` })
        ).toBeVisible({ timeout: 10000 });

        await expect(page.getByText(sdk.wsMessage).first()).toBeVisible({ timeout: 15000 });
      } finally {
        await proc.stop();
      }
    });
  }
});
