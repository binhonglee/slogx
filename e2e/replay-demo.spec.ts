import { test, expect } from '@playwright/test';

test.describe('Replay Demo Mode', () => {
  test('loads built-in CI demo logs', async ({ page }) => {
    await page.goto('/replay.html');

    await page.getByRole('button', { name: 'Try Demo CI Logs' }).click();

    await expect(page.locator('.file-info-header')).toContainText('ci-demo.ndjson');
    await expect(page.getByText('CI pipeline started')).toBeVisible();
  });
});
