import { test, expect } from '@playwright/test';

/**
 * Sprint 1 — PBI-21 (Pencarian Lokasi Peta via Nominatim).
 * dibuat oleh: Raihan Ardhana
 */

test.describe('PBI-21 — Pencarian Lokasi', () => {
  test('kotak pencarian lokasi tampil di peta', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder(/Cari nama jalan, daerah, tempat/i)).toBeVisible({ timeout: 20_000 });
  });

  test('mengetik kata kunci diterima oleh input pencarian (Nominatim)', async ({ page }) => {
    await page.goto('/');
    const search = page.getByPlaceholder(/Cari nama jalan, daerah, tempat/i);
    await expect(search).toBeVisible({ timeout: 20_000 });
    await search.fill('Bandung');
    await expect(search).toHaveValue('Bandung');
    await page.waitForTimeout(2500); // beri waktu request eksternal
  });
});
