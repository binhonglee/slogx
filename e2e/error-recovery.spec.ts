import { test, expect } from '@playwright/test';

// Helper: locate a connection chip by its displayed URL text (host:port)
const chipByUrl = (page: any, displayUrl: string) =>
  page.locator('.connection-chip', { hasText: displayUrl });

test.describe('Error Recovery', () => {
  test('handles connection errors gracefully', async ({ page }) => {
    await page.goto('/app.html');
    
    // Add a connection that does not exist to simulate an error
    const input = page.locator('.connection-form input');
    await input.fill('localhost:12345');
    await page.locator('.connection-form button[type="submit"]').click();
    
    // Check if error status chip appears
    const chip = chipByUrl(page, 'localhost:12345');
    // Using simple waiting, usually it changes its class to 'error'
    await expect(chip).toHaveClass(/error/, { timeout: 5000 });
  });

  test('UI state reflects disconnection', async ({ page }) => {
    await page.goto('/app.html');

    const input = page.locator('.connection-form input');
    await input.fill('127.0.0.1:9090');
    await page.locator('.connection-form button[type="submit"]').click();
    
    const chip = chipByUrl(page, '127.0.0.1:9090');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveClass(/error/, { timeout: 5000 });
  });
});
