import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-32 / FS-82 (Time-lapse / Pemutaran Historis Heatmap).
 */

test.describe('PBI-32 — Time-lapse Heatmap', () => {
  test('TC: tombol time-lapse pada peta membuka panel slider', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    const btn = page.getByTitle(/Time-lapse historis/i);
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();
    // Panel time-lapse memuat kontrol (Play / slider / label waktu).
    await expect(page.getByText(/Time-lapse|jam|hari/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
