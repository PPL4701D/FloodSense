import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 1 — PBI-3 (RBAC + Supabase RLS lewat proteksi route per role).
 * dibuat oleh: Ihsan Andi
 */

test.describe('PBI-3 — RBAC (proteksi route per role)', () => {
  test('warga tidak bisa mengakses /admin (dialihkan)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 15_000 });
  });

  test('staf bisa mengakses verifikasi laporan', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/verification');
    await expect(page.getByRole('heading', { name: /Verifikasi Laporan/i })).toBeVisible();
  });

  test('admin bisa mengakses panel admin', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin');
    await expect(page.getByText(/Admin Panel/i)).toBeVisible();
  });

  test('warga tidak bisa mengakses dashboard analitik (dialihkan)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});
