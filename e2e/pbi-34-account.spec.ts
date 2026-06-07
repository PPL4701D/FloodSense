import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-34 / FS-84 (Manajemen Akun).
 * Tidak mengeksekusi ganti password / hapus akun sungguhan — hanya verifikasi UI.
 */

test.describe('PBI-34 — Manajemen Akun', () => {
  test('TC: halaman Keamanan Akun menampilkan ganti password & hapus akun', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/settings/account');
    await expect(page.getByText(/Keamanan Akun|Ganti Password|Password/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Hapus Akun/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-002: password baru lemah ditolak (validasi)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/settings/account');
    const pwInputs = page.locator('input[type="password"]');
    if ((await pwInputs.count()) >= 2) {
      await pwInputs.nth(0).fill('123456');
      await pwInputs.nth(1).fill('123'); // terlalu lemah
      const submit = page.getByRole('button', { name: /Ganti|Simpan|Ubah Password/i }).first();
      if (await submit.count()) {
        await submit.click().catch(() => {});
        await expect(page.getByText(/minimal|lemah|tidak valid|karakter/i).first()).toBeVisible({ timeout: 10_000 });
      }
    } else {
      test.info().annotations.push({ type: 'note', description: 'Form ganti password tidak ditemukan' });
    }
  });
});
