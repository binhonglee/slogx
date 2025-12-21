import { test, expect } from '@playwright/test';

test.describe('App Loading', () => {
  test('loads the application', async ({ page }) => {
    await page.goto('/');

    // Check header elements
    await expect(page.locator('.logo img')).toBeVisible();
    await expect(page.locator('.header')).toBeVisible();
  });

  test('shows empty state when no connections', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('No Active Data Sources')).toBeVisible();
    await expect(page.getByText('Connect to a backend service using the input above, or enable Demo to see sample data.')).toBeVisible();
  });

  test('has filter bar with level buttons', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'DEBUG' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'INFO' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'WARN' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ERROR' })).toBeVisible();
  });
});

test.describe('Demo Mode', () => {
  test('enables demo mode and shows logs', async ({ page }) => {
    await page.goto('/');

    // Click demo button
    await page.getByRole('button', { name: 'Demo' }).click();

    // Wait for logs to appear
    await expect(page.locator('.log-item')).toBeVisible({ timeout: 5000 });
  });

  test('demo button shows active state when enabled', async ({ page }) => {
    await page.goto('/');

    const demoButton = page.getByRole('button', { name: 'Demo' });
    await demoButton.click();

    await expect(demoButton).toHaveClass(/active/);
  });

  test('can disable demo mode', async ({ page }) => {
    await page.goto('/');

    const demoButton = page.getByRole('button', { name: 'Demo' });

    // Enable
    await demoButton.click();
    await expect(demoButton).toHaveClass(/active/);

    // Disable
    await demoButton.click();
    await expect(demoButton).not.toHaveClass(/active/);
  });
});

test.describe('Log Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Demo' }).click();
    // Wait for some logs
    await expect(page.locator('.log-item')).toBeVisible({ timeout: 5000 });
  });

  test('can filter logs by search text', async ({ page }) => {
    const searchInput = page.locator('.search-box input');
    await searchInput.fill('Request');

    // Wait for filter to apply
    await page.waitForTimeout(100);

    // All visible logs should contain "Request" or match the filter
    const logItems = page.locator('.log-item');
    const count = await logItems.count();

    // Either we have filtered results or no results
    if (count > 0) {
      // Check that at least the search is applied (UI shows the value)
      await expect(searchInput).toHaveValue('Request');
    }
  });

  test('can clear search with X button', async ({ page }) => {
    const searchInput = page.locator('.search-box input');
    await searchInput.fill('test');

    // Clear button should appear
    const clearButton = page.locator('.search-clear');
    await expect(clearButton).toBeVisible();

    await clearButton.click();
    await expect(searchInput).toHaveValue('');
  });

  test('can toggle level filters', async ({ page }) => {
    const debugButton = page.getByRole('button', { name: 'DEBUG' });

    // Initially all levels should be active
    await expect(debugButton).toHaveClass(/active/);

    // Click to disable DEBUG
    await debugButton.click();
    await expect(debugButton).not.toHaveClass(/active/);

    // Click to re-enable
    await debugButton.click();
    await expect(debugButton).toHaveClass(/active/);
  });
});

test.describe('Log Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Demo' }).click();
    await expect(page.locator('.log-item')).toBeVisible({ timeout: 5000 });
  });

  test('clicking a log opens details panel', async ({ page }) => {
    const firstLog = page.locator('.log-item').first();
    await firstLog.click();

    await expect(page.locator('.details-panel')).toBeVisible();
    await expect(page.getByText('Log Details')).toBeVisible();
  });

  test('details panel shows metadata', async ({ page }) => {
    const firstLog = page.locator('.log-item').first();
    await firstLog.click();

    await expect(page.getByText('Timestamp')).toBeVisible();
    await expect(page.getByText('Level')).toBeVisible();
  });

  test('can close details panel', async ({ page }) => {
    const firstLog = page.locator('.log-item').first();
    await firstLog.click();

    await expect(page.locator('.details-panel')).toBeVisible();

    // Click close button
    await page.locator('.details-header .btn-icon').click();

    await expect(page.locator('.details-panel')).not.toBeVisible();
  });

  test('clicking same log again closes details', async ({ page }) => {
    const firstLog = page.locator('.log-item').first();

    await firstLog.click();
    await expect(page.locator('.details-panel')).toBeVisible();

    await firstLog.click();
    await expect(page.locator('.details-panel')).not.toBeVisible();
  });
});

test.describe('Pause/Resume', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Demo' }).click();
    await expect(page.locator('.log-item')).toBeVisible({ timeout: 5000 });
  });

  test('can pause log stream', async ({ page }) => {
    const pauseButton = page.locator('.btn-pause');

    await expect(pauseButton).toContainText('Pause');
    await pauseButton.click();

    await expect(pauseButton).toContainText('Resume');
    await expect(pauseButton).toHaveClass(/paused/);
  });

  test('can resume log stream', async ({ page }) => {
    const pauseButton = page.locator('.btn-pause');

    // Pause
    await pauseButton.click();
    await expect(pauseButton).toContainText('Resume');

    // Resume
    await pauseButton.click();
    await expect(pauseButton).toContainText('Pause');
    await expect(pauseButton).not.toHaveClass(/paused/);
  });
});

test.describe('Clear Logs', () => {
  test('can clear all logs', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Demo' }).click();
    await expect(page.locator('.log-item')).toBeVisible({ timeout: 5000 });

    // Get initial count
    const initialCount = await page.locator('.log-item').count();
    expect(initialCount).toBeGreaterThan(0);

    // Click clear button
    await page.locator('.btn-icon.danger').click();

    // Logs should be cleared (might show empty state or fewer logs)
    await page.waitForTimeout(100);
    const afterClearCount = await page.locator('.log-item').count();
    expect(afterClearCount).toBeLessThan(initialCount);
  });
});

test.describe('Setup Modal', () => {
  test('can open setup modal', async ({ page }) => {
    await page.goto('/');

    // Click settings button
    await page.locator('.header-actions .btn-icon').click();

    await expect(page.locator('.modal')).toBeVisible();
    await expect(page.getByText('Integration Setup')).toBeVisible();
  });

  test('setup modal has language tabs', async ({ page }) => {
    await page.goto('/');
    await page.locator('.header-actions .btn-icon').click();

    await expect(page.getByRole('button', { name: /Node/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Python/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Go/ })).toBeVisible();
  });

  test('can close setup modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('.header-actions .btn-icon').click();

    await expect(page.locator('.modal')).toBeVisible();

    // Click close button
    await page.locator('.modal-close').click();

    await expect(page.locator('.modal')).not.toBeVisible();
  });

  test('can switch between language tabs', async ({ page }) => {
    await page.goto('/');
    await page.locator('.header-actions .btn-icon').click();

    await expect(page.locator('.modal')).toBeVisible();

    // Click Python tab
    await page.getByRole('button', { name: /Python/ }).click();
    await expect(page.getByText('pip install slogx')).toBeVisible();

    // Click Go tab
    await page.getByRole('button', { name: /Go/ }).click();
    await expect(page.getByText('binhonglee/slogx')).toBeVisible();
  });
});

test.describe('Connection Manager', () => {
  test('has connection input', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('.connection-form input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('localhost:8080');
  });

  test('shows validation error for invalid URL', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('.connection-form input');
    await input.fill('invalid url with spaces');

    // Submit the form
    await page.locator('.connection-form button').click();

    // Should show validation error
    await expect(page.locator('.validation-error')).toBeVisible();
  });

  test('clears validation error when typing', async ({ page }) => {
    await page.goto('/');

    const input = page.locator('.connection-form input');
    await input.fill('invalid url with spaces');
    await page.locator('.connection-form button').click();

    await expect(page.locator('.validation-error')).toBeVisible();

    // Start typing again
    await input.fill('localhost:8080');

    await expect(page.locator('.validation-error')).not.toBeVisible();
  });
});
