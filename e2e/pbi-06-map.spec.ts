import { test, expect } from '@playwright/test';

/**
 * Sprint 1 — PBI-6 (Peta Interaktif Nasional + Heatmap Real-time).
 * dibuat oleh: Andrarieza Rizqi Pradana
 */

test.describe('PBI-6 — Peta Interaktif & Heatmap', () => {
  test('beranda menampilkan peta Leaflet', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
  });

  test('peta menampilkan indikator jumlah laporan aktif', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/laporan aktif/i)).toBeVisible();
  });

  test('tile peta dasar termuat', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    // Minimal satu tile peta ter-render di DOM.
    await expect(page.locator('img.leaflet-tile').first()).toBeAttached({ timeout: 20_000 });
  });
});
