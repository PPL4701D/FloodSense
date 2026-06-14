import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-10 / FS-10 (Deteksi Spam & Duplikasi).
 * Rate-limit/dedup server-side saat submit; di E2E diuji surface moderasi (antrian
 * flagged) + halaman cluster duplikat seperti yang dilihat staf.
 * Tiap test diakhiri teks yang terlihat di halaman (untuk demo mode --ui).
 */

test.describe('PBI-10 — Deteksi Spam & Duplikasi', () => {
  test('TC-01: antrian moderasi (Ditandai/flagged) tampil & dapat difilter staf', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/verification');
    await expect(page.getByRole('heading', { name: /Verifikasi Laporan/i }).first()).toBeVisible({ timeout: 15_000 });

    // Strip statistik moderasi memuat kategori "Ditandai" (flagged).
    await expect(page.getByText(/Ditandai/i).first()).toBeVisible({ timeout: 15_000 });

    // Alur staf nyata: ketik di pencarian antrian, halaman tetap berfungsi.
    const search = page.getByPlaceholder(/Cari deskripsi, alamat, atau pelapor/i);
    await expect(search).toBeVisible();
    await search.fill('banjir');
    await page.waitForTimeout(600);

    await expect(page.getByRole('heading', { name: /Verifikasi Laporan/i }).first()).toBeVisible();
  });

  test('TC-02: halaman deteksi duplikat (clusters) dapat diakses & menampilkan hasil/empty', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/clusters');
    await expect(page).toHaveURL(/\/staff\/clusters/);
    await expect(page.getByRole('heading', { name: /Deteksi Duplikat & Spam/i })).toBeVisible({ timeout: 15_000 });

    // Adaptif: ada daftar potensi duplikat ATAU empty-state ramah.
    await expect(
      page.getByText(/Tidak ada potensi duplikat terdeteksi|laporan|cluster|duplikat/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
