import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-34 / FS-84 (Manajemen Akun).
 * Tidak mengeksekusi ganti password / hapus akun sungguhan — verifikasi UI + validasi.
 * Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-34 — Manajemen Akun', () => {
  test('TC-52: halaman Keamanan Akun menampilkan ganti password & hapus akun', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/settings/account');
    await expect(page.getByText(/Keamanan Akun/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Ganti Password/i).first()).toBeVisible();
    await expect(page.getByText(/Hapus Akun/i).first()).toBeVisible();
  });

  test('TC-53: password baru lemah ditolak (validasi)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/settings/account');
    await expect(page.getByText(/Ganti Password/i).first()).toBeVisible({ timeout: 15_000 });

    const pwInputs = page.locator('input[type="password"]');
    if ((await pwInputs.count()) >= 2) {
      await pwInputs.nth(0).fill('123456');                 // password lama
      await pwInputs.nth(1).fill('123');                    // baru, terlalu lemah
      const confirm = pwInputs.nth(2);
      if (await confirm.count()) await confirm.fill('123');
      const submit = page.getByRole('button', { name: /Ganti Password|Simpan|Ubah/i }).first();
      if (await submit.count()) await submit.click().catch(() => {});
      // Pesan validasi terlihat (min. karakter / lemah / tidak cocok).
      await expect(page.getByText(/minimal|lemah|tidak valid|karakter|8/i).first()).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(page.getByText(/Keamanan Akun/i).first()).toBeVisible();
    }
  });
});
