import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-29 / FS-79 (Manajemen Wilayah / Region CRUD Admin).
 */

test.describe('PBI-29 — Region CRUD Admin', () => {
  test('TC-001: non-admin tidak bisa akses /admin/regions (forbidden/dialihkan)', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/admin/regions');
    await expect(page).not.toHaveURL(/\/admin\/regions/, { timeout: 15_000 });
  });

  test('admin melihat list wilayah + search + tombol Tambah', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/regions');
    await expect(page.getByRole('heading', { name: /Manajemen Wilayah/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder(/Cari nama \/ kode/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Tambah Wilayah/i })).toBeVisible();
  });

  test('TC: form tambah wilayah dapat dibuka', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/regions');
    await page.getByRole('button', { name: /Tambah Wilayah/i }).click();
    await expect(page.getByRole('heading', { name: /Tambah Wilayah/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder(/Jawa Barat/i)).toBeVisible();
  });

  test('TC: editor boundary (peta) dapat dibuka dari item wilayah', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/regions');
    await expect(page.getByRole('heading', { name: /Manajemen Wilayah/i })).toBeVisible({ timeout: 15_000 });
    const boundaryBtn = page.getByRole('button', { name: /Boundary \(peta\)/i }).first();
    await expect(boundaryBtn).toBeVisible({ timeout: 15_000 });
    await boundaryBtn.click();
    await expect(page.getByRole('heading', { name: /Boundary —/i })).toBeVisible({ timeout: 10_000 });
  });
});
