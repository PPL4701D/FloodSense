import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 1 — PBI-14 (User Management oleh Admin).
 * dibuat oleh: Viki Firmansyah
 */

test.describe('PBI-14 — Manajemen Pengguna Admin', () => {
  test('admin melihat halaman kelola pengguna + pencarian', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /Kelola Pengguna/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Cari nama atau email/i)).toBeVisible();
  });

  test('daftar pengguna memuat minimal satu akun', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByText(/@fs\.id|@gmail\.com/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('warga tidak bisa mengakses /admin/users (dialihkan)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/admin/users');
    await expect(page).not.toHaveURL(/\/admin\/users/, { timeout: 15_000 });
  });
});
