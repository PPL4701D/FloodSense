import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 1 — PBI-9 (Verifikasi Laporan oleh Staf).
 * dibuat oleh: Valerina
 */

test.describe('PBI-9 — Verifikasi Laporan', () => {
  test('staf melihat antrian verifikasi', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/verification');
    await expect(page.getByRole('heading', { name: /Verifikasi Laporan/i })).toBeVisible();
    await expect(
      page.getByText(/laporan memerlukan perhatian/i).or(page.getByText(/Semua laporan sudah ditangani/i))
    ).toBeVisible();
  });

  test('warga tidak bisa mengakses verifikasi (dialihkan)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/staff/verification');
    await expect(page).not.toHaveURL(/\/staff\/verification/, { timeout: 15_000 });
  });
});
