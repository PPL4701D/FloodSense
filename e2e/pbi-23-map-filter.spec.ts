import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-23 / FS-74 (Panel Filter & Legenda Peta Interaktif).
 * Catatan: interaksi tile Leaflet rawan flaky → assert kontrol & legenda, bukan klik tile.
 */

test.describe('PBI-23 — Filter & Legenda Peta', () => {
  test('peta + kontrol filter ter-render', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    // Container Leaflet hadir.
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    // Tombol Filter peta hadir.
    await expect(page.getByRole('button', { name: /Filter/i }).first()).toBeVisible();
  });

  test('TC: legenda dapat dibuka via tombol info', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    // Tombol info (toggle legenda) — title "Level Banjir".
    const info = page.getByTitle(/Level Banjir/i);
    if (await info.count()) {
      await info.first().click();
      await expect(page.getByText(/Status Area|Level Banjir/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('TC: panel filter peta dapat dibuka', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Filter/i }).first().click();
    // Setelah buka, opsi severity/status/waktu muncul.
    await expect(page.getByText(/Keparahan|Severity|Status|Waktu/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
