import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 1 — PBI-19 (Profil Pengguna & Preferensi Notifikasi).
 * dibuat oleh: Adnan Rizki
 */

test.describe('PBI-19 — Profil & Preferensi Notifikasi', () => {
  test('profil menampilkan email & menu akun untuk pengguna login', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/profile');
    await expect(page.getByText('warga@fs.id')).toBeVisible();
    await expect(page.locator('button.btn-danger', { hasText: 'Keluar' })).toBeVisible();
    await expect(page.getByText(/Laporan Saya/i)).toBeVisible();
  });

  test('halaman preferensi notifikasi tampil', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/settings/notifications');
    await expect(page.getByRole('heading', { name: /Preferensi Notifikasi/i })).toBeVisible();
  });

  test('profil tanpa login menawarkan masuk', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByText(/Masuk untuk Melihat Profil|Masuk/i).first()).toBeVisible();
  });
});
