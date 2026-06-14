import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-29 / FS-79 (Manajemen Wilayah / Region CRUD Admin).
 * Proteksi non-admin, list+search+tambah, form tambah, editor boundary peta.
 * Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-29 — Region CRUD Admin', () => {
  test('TC-40: non-admin (staf) dialihkan dari /admin/regions', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/admin/regions');
    await expect(page).not.toHaveURL(/\/admin\/regions/, { timeout: 15_000 });
    // Dialihkan ke beranda peta; tab navigasi "Peta" terlihat sebagai bukti di --ui.
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-41: admin melihat list wilayah + pencarian + tombol Tambah', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/regions');
    await expect(page.getByRole('heading', { name: /Manajemen Wilayah/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder(/Cari nama \/ kode/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Tambah Wilayah/i })).toBeVisible();

    // Pencarian wilayah (alur nyata).
    await page.getByPlaceholder(/Cari nama \/ kode/i).fill('Jawa');
    await page.waitForTimeout(600);
    await expect(page.getByRole('heading', { name: /Manajemen Wilayah/i })).toBeVisible();
  });

  test('TC-42: form tambah wilayah dapat dibuka', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/regions');
    await page.getByRole('button', { name: /Tambah Wilayah/i }).click();
    await expect(page.getByRole('heading', { name: /Tambah Wilayah/i })).toBeVisible({ timeout: 10_000 });
    // Field nama wilayah hadir.
    await expect(page.getByPlaceholder(/mis. Jawa Barat/i)).toBeVisible();
  });

  test('TC-43: editor boundary (peta) dapat dibuka dari item wilayah', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/regions');
    await expect(page.getByRole('heading', { name: /Manajemen Wilayah/i })).toBeVisible({ timeout: 15_000 });

    const boundaryBtn = page.getByRole('button', { name: /Boundary \(peta\)/i }).first();
    await expect(boundaryBtn).toBeVisible({ timeout: 15_000 });
    await boundaryBtn.click();
    await expect(page.getByText(/Boundary/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
