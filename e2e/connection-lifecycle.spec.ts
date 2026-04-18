import { test, expect } from '@playwright/test';

// Helper: locate a connection chip by its displayed URL text (host:port)
const chipByUrl = (page: any, displayUrl: string) =>
  page.locator('.connection-chip', { hasText: displayUrl });

test.describe('Connection Lifecycle', () => {
  test('can add and remove multiple connections', async ({ page }) => {
    await page.goto('/app.html');

    const input = page.locator('.connection-form input');
    const submitBtn = page.locator('.connection-form button[type="submit"]');

    // Add first connection
    await input.fill('localhost:8081');
    await submitBtn.click();

    // Add second connection
    await input.fill('localhost:8082');
    await submitBtn.click();

    // Verify both chips are visible
    await expect(chipByUrl(page, 'localhost:8081')).toBeVisible();
    await expect(chipByUrl(page, 'localhost:8082')).toBeVisible();

    // Remove first connection
    await chipByUrl(page, 'localhost:8081').locator('.remove-btn').click();

    await expect(chipByUrl(page, 'localhost:8081')).not.toBeVisible();
    await expect(chipByUrl(page, 'localhost:8082')).toBeVisible();
  });

  test('connections persist across page reload', async ({ page }) => {
    await page.goto('/app.html');

    const input = page.locator('.connection-form input');
    await input.fill('localhost:8888');
    await page.locator('.connection-form button[type="submit"]').click();

    await expect(chipByUrl(page, 'localhost:8888')).toBeVisible();

    await page.reload();

    await expect(chipByUrl(page, 'localhost:8888')).toBeVisible();
  });
});
