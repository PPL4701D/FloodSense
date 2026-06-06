import { test, expect } from '@playwright/test';

/**
 * Sprint 1 — PBI-7 (Popup Detail Laporan & Toggle Layer/Legenda Peta).
 * dibuat oleh: Ihsan Andi
 */

test.describe('PBI-7 — Detail Laporan & Toggle Layer', () => {
  test('membuka detail laporan dari daftar', async ({ page }) => {
    await page.goto('/reports');
    const firstReport = page.locator('a[href^="/report/"]').first();
    await expect(firstReport).toBeVisible({ timeout: 20_000 });
    await firstReport.click();
    await expect(page).toHaveURL(/\/report\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: 'Detail Laporan' })).toBeVisible();
  });

  test('toggle legenda peta menampilkan Level Banjir', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Level Banjir/i }).click();
    await expect(page.getByText('Level Banjir')).toBeVisible();
  });
});
