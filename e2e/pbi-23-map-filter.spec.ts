import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-23 / FS-74 (Panel Filter & Legenda Peta Interaktif).
 * Interaksi tile Leaflet rawan flaky → assert kontrol, legenda, & panel filter (teks),
 * bukan klik tile. Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-23 — Filter & Legenda Peta', () => {
  test('TC-24: peta + kontrol Filter ter-render', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    // Tombol Filter peta hadir (label teks "Filter").
    await expect(page.getByRole('button', { name: /Filter/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-25: legenda dapat dibuka via tombol info (Level Banjir)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });

    const info = page.getByTitle(/Level Banjir/i).first();
    await expect(info).toBeVisible({ timeout: 15_000 });
    await info.click();
    // Legenda warna severity / status area tampil.
    await expect(page.getByText(/Ringan|Sedang|Berat|Status Area|Level Banjir/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('TC-26: panel filter peta dapat dibuka & memuat opsi', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Filter/i }).first().click();
    // Panel "Filter Laporan" + opsi keparahan/status/waktu.
    await expect(page.getByText(/Tingkat Keparahan|Rentang Waktu|Filter Laporan/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
