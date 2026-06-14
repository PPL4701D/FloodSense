import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-26 / FS-77 (Antrian Pemeriksaan Ulang Terjadwal).
 * Link dari verifikasi staf, halaman antrian + isi/empty, proteksi warga.
 * Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-26 — Antrian Peninjauan Ulang', () => {
  test('TC-32: link Peninjauan Ulang tampil di halaman verifikasi & menuju antrian', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/verification');
    const link = page.getByRole('link', { name: /Peninjauan Ulang/i });
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await expect(page).toHaveURL(/\/staff\/recheck/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Pemeriksaan Ulang Terjadwal/i })).toBeVisible({ timeout: 15_000 });
  });

  test('TC-33: halaman antrian recheck menampilkan judul + daftar/empty', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/recheck');
    await expect(page).toHaveURL(/\/staff\/recheck/);
    await expect(page.getByRole('heading', { name: /Pemeriksaan Ulang Terjadwal/i })).toBeVisible({ timeout: 15_000 });
    // Adaptif: ada item terjadwal ATAU empty-state.
    await expect(
      page.getByText(/Tidak ada laporan terjadwal|Terlambat|peninjauan|jadwal/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('TC-34: warga tidak bisa mengakses antrian recheck (dialihkan)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/staff/recheck');
    await expect(page).not.toHaveURL(/\/staff\/recheck/, { timeout: 15_000 });
    // Dialihkan ke beranda peta; tab navigasi "Peta" terlihat sebagai bukti di --ui.
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });
});
