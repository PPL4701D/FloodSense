import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 1 — PBI-4 (Form Pelaporan: GPS, Foto, Ketinggian — wizard 4 langkah).
 * dibuat oleh: Viki Firmansyah
 */

test.describe('PBI-4 — Form Pelaporan', () => {
  test('membuka /report/new tanpa login dialihkan ke login', async ({ page }) => {
    await page.goto('/report/new');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  test('warga login melihat form pelaporan (wizard langkah 1: lokasi)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/report/new');
    await expect(page.getByRole('heading', { name: 'Lapor Banjir' })).toBeVisible();
    await expect(page.getByText(/Langkah 1 dari 4/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lokasi Banjir' })).toBeVisible();
  });

  test('lanjut ke langkah 2 menampilkan tingkat keparahan', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/report/new');
    await page.getByRole('button', { name: /Lanjut/i }).click();
    await expect(page.getByRole('heading', { name: 'Tingkat Keparahan' })).toBeVisible();
  });
});
