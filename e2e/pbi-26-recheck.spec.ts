import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-26 / FS-77 (Antrian Pemeriksaan Ulang Terjadwal).
 */

test.describe('PBI-26 — Antrian Peninjauan Ulang', () => {
  test('link Peninjauan Ulang tampil di halaman verifikasi staf', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/verification');
    await expect(page.getByRole('link', { name: /Peninjauan Ulang/i })).toBeVisible({ timeout: 15_000 });
  });

  test('TC: halaman antrian recheck dapat diakses & menampilkan judul', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/recheck');
    await expect(page).toHaveURL(/\/staff\/recheck/);
    await expect(page.getByRole('heading', { name: /Peninjauan Ulang|Pemeriksaan Ulang|Terjadwal/i })).toBeVisible({ timeout: 15_000 });
  });

  test('warga tidak bisa mengakses antrian recheck (dialihkan)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/staff/recheck');
    await expect(page).not.toHaveURL(/\/staff\/recheck/, { timeout: 15_000 });
  });
});
