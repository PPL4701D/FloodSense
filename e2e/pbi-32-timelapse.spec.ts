import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-32 / FS-82 (Time-lapse / Pemutaran Historis Heatmap).
 *
 * Panel "Time-lapse Banjir" di peta: rentang 24 Jam/7 Hari, slider, Putar/Jeda,
 * Ulang, kecepatan 1x/2x/4x. Saat data historis ADA → kontrol pemutaran tampil;
 * saat KOSONG / sumber data ERROR → empty-state "Tidak ada laporan pada rentang ini".
 *
 * Positive memakai DATA NYATA (seed laporan 7 hari terakhir di DB testing).
 * Negative/exception memakai SIMULASI via intersepsi jaringan (page.route) atas RPC
 * get_map_reports — DB asli tidak disentuh (standar uji empty-state & error-handling).
 *
 * 1 positive komprehensif + 2 negative/exception.
 */

const RPC_MAP_REPORTS = '**/rest/v1/rpc/get_map_reports';
const EMPTY_MSG = /Tidak ada laporan pada rentang ini/i;

test.describe('PBI-32 — Time-lapse Heatmap', () => {

  // ============================ POSITIVE ============================

  test('P1 (TC-49): buka time-lapse, jalankan animasi (Putar/Jeda), kecepatan, ulang, ganti rentang, tutup', async ({ page }) => {
    // 1. Login & buka beranda (peta).
    await login(page, 'warga');
    await page.goto('/');
    // 2. Pastikan peta Leaflet tampil.
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });

    // 3. Klik tombol "Time-lapse historis" pada peta.
    await page.getByTitle(/Time-lapse historis/i).first().click();
    // 4. Panel "Time-lapse Banjir" terbuka.
    await expect(page.getByText(/Time-lapse Banjir/i)).toBeVisible({ timeout: 10_000 });

    // 5. Data historis termuat → kontrol pemutaran tampil: tombol "Putar" + jumlah "{N} laporan".
    const putar = page.getByRole('button', { name: /Putar/i });
    await expect(putar).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/\d+ laporan/i)).toBeVisible();
    // 6. Slider rentang waktu tampil.
    await expect(page.locator('input[type="range"]')).toBeVisible();

    // 7. Klik "Putar" → animasi jalan, tombol berubah jadi "Jeda".
    await putar.click();
    await expect(page.getByRole('button', { name: /Jeda/i })).toBeVisible({ timeout: 10_000 });
    // 8. Klik "Jeda" → kembali ke "Putar".
    await page.getByRole('button', { name: /Jeda/i }).click();
    await expect(page.getByRole('button', { name: /Putar/i })).toBeVisible();

    // 9. Ganti kecepatan ke "4x".
    await page.getByRole('button', { name: '4x', exact: true }).click();
    // 10. Klik "Ulang" (reset ke awal rentang).
    await page.getByTitle('Ulang', { exact: true }).click();

    // 11. Ganti rentang ke "24 Jam" → panel tetap tampil (data dimuat ulang).
    await page.getByRole('button', { name: '24 Jam', exact: true }).click();
    await expect(page.getByText(/Time-lapse Banjir/i)).toBeVisible();

    // 12. Klik X (Tutup) → panel "Time-lapse Banjir" hilang. (bukti akhir terlihat)
    await page.getByRole('button', { name: 'Tutup' }).first().click();
    await expect(page.getByText(/Time-lapse Banjir/i)).toHaveCount(0);
    await expect(page.getByTitle(/Time-lapse historis/i).first()).toBeVisible({ timeout: 10_000 });
  });

  // ===================== NEGATIVE / EXCEPTION =====================

  test('N1 (TC-63): rentang tanpa laporan (data kosong) → empty-state, kontrol pemutaran tak muncul', async ({ page }) => {
    // 1. Login & buka beranda; pastikan peta tampil.
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });

    // 2. (Simulasi) data laporan historis dikembalikan KOSONG (intercept RPC → []).
    //    DB asli tetap utuh — hanya respons untuk browser test ini yang dipalsukan.
    await page.route(RPC_MAP_REPORTS, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    // 3. Klik "Time-lapse historis" → panel "Time-lapse Banjir" terbuka.
    await page.getByTitle(/Time-lapse historis/i).first().click();
    await expect(page.getByText(/Time-lapse Banjir/i)).toBeVisible({ timeout: 10_000 });

    // 4. Empty-state tampil. (bukti akhir terlihat)
    await expect(page.getByText(EMPTY_MSG)).toBeVisible({ timeout: 15_000 });
    // 5. Kontrol pemutaran (slider/Putar) TIDAK muncul; aplikasi tidak crash.
    await expect(page.getByRole('button', { name: /Putar|Jeda/i })).toHaveCount(0);
    await expect(page.locator('input[type="range"]')).toHaveCount(0);
  });

  test('N2 (TC-64): sumber data historis error (RPC 500) → panel tetap aman, tidak crash', async ({ page }) => {
    // 1. Login & buka beranda; pastikan peta tampil.
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });

    // 2. (Simulasi) endpoint data historis (get_map_reports) dikembalikan ERROR 500.
    await page.route(RPC_MAP_REPORTS, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'error (uji E2E)' }) })
    );

    // 3. Klik "Time-lapse historis" → panel tetap terbuka.
    await page.getByTitle(/Time-lapse historis/i).first().click();
    await expect(page.getByText(/Time-lapse Banjir/i)).toBeVisible({ timeout: 10_000 });

    // 4. Error ditangani: panel aman, tampil empty-state, aplikasi tidak crash. (bukti akhir terlihat)
    await expect(page.getByText(EMPTY_MSG)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Putar|Jeda/i })).toHaveCount(0);
  });
});
