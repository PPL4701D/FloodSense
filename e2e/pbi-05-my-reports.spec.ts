import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 1 — PBI-5 (Riwayat & Manajemen Laporan Pribadi).
 * dibuat oleh: Dwi Putra
 */

test.describe('PBI-5 — Riwayat Laporan Pribadi', () => {
  test('warga login melihat halaman "Laporan Saya"', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/my-reports');
    await expect(page.getByRole('heading', { name: 'Laporan Saya' })).toBeVisible();
  });

  test('daftar laporan publik /reports tampil dengan pencarian', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible();
    await expect(page.getByPlaceholder(/Cari lokasi atau deskripsi/i)).toBeVisible();
  });
});
