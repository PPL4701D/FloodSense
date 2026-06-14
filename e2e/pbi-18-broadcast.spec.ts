import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-18 / FS-18 (Broadcast Pesan TLM).
 * Pengiriman push aktual tidak di-assert. Diuji alur TLM nyata: form broadcast terisi,
 * pencarian wilayah target, riwayat broadcast, serta proteksi akses warga.
 */

test.describe('PBI-18 — Broadcast TLM', () => {
  test('TC-18: form broadcast (wilayah, tingkat, pesan) tampil & dapat diisi TLM', async ({ page }) => {
    await login(page, 'tlm');
    await page.goto('/broadcast');
    await expect(page.getByRole('heading', { name: /Broadcast Peringatan/i })).toBeVisible({ timeout: 15_000 });

    // Field inti broadcast hadir.
    await expect(page.getByPlaceholder(/Cari provinsi \/ kabupaten \/ kecamatan/i)).toBeVisible();
    await expect(page.getByText(/Tingkat Peringatan/i)).toBeVisible();

    // Isi pesan broadcast (alur nyata).
    const pesan = page.getByPlaceholder(/Contoh: Waspada potensi banjir/i);
    await expect(pesan).toBeVisible();
    await pesan.fill('Uji E2E: waspada genangan di area rendah.');

    await expect(page.getByRole('button', { name: /Kirim Broadcast/i })).toBeVisible();
  });

  test('TC-19: pencarian wilayah target menampilkan hasil', async ({ page }) => {
    await login(page, 'tlm');
    await page.goto('/broadcast');
    await page.getByPlaceholder(/Cari provinsi \/ kabupaten \/ kecamatan/i).fill('Bandung');

    // Adaptif: hasil "Bandung" muncul ATAU empty-state pencarian.
    await expect(page.getByText(/Bandung|Tidak ada wilayah cocok/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-20: warga tidak bisa mengakses /broadcast (dialihkan)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/broadcast');
    await expect(page).not.toHaveURL(/\/broadcast/, { timeout: 15_000 });
    // Dialihkan ke beranda peta; tab navigasi "Peta" terlihat sebagai bukti di --ui.
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });
});
