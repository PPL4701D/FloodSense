import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-13 / FS-13 (Ekspor Data CSV & PDF).
 */

test.describe('PBI-13 — Ekspor CSV & PDF', () => {
  test('TC-001: ekspor CSV mengunduh file', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });
    const csvBtn = page.getByRole('button', { name: /CSV/i }).first();
    await expect(csvBtn).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      csvBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('TC-002: tombol ekspor PDF tersedia', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /PDF/i }).first()).toBeVisible();
  });
});
