import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-23 / FS-74 (Panel Filter & Legenda Peta Interaktif).
 * Interaksi tile Leaflet rawan flaky → assert kontrol, legenda, & panel filter (teks),
 * bukan klik tile. Tiap test berakhir pada teks yang terlihat.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TC-24 — PBI-23 / FS-74  [Positive]
// Skenario   : Peta, legenda, dan panel filter ter-render serta dapat diakses
// ─────────────────────────────────────────────────────────────────────────────
// TC-25 — PBI-23 / FS-74  [Negative]
// Skenario   : Elemen interaktif (legenda & panel filter) dapat ditutup kembali
//              — legenda via toggle, panel filter via klik di luar area
// Referensi  : src/components/map/MapFilterControl.tsx baris 66-71
//              useEffect: document.addEventListener('mousedown', onClick)
//              if (!wrapRef.current.contains(e.target)) setOpen(false)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('PBI-23 — Filter & Legenda Peta', () => {
  test('TC-24: [POSITIVE] Peta, legenda, dan panel filter ter-render serta dapat diakses', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });

    // Step 1: Tombol Filter peta hadir
    const filterBtn = page.getByRole('button', { name: /Filter/i }).first();
    await expect(filterBtn).toBeVisible({ timeout: 15_000 });

    // Step 2: Buka panel filter
    await filterBtn.click();
    await expect(page.getByText('Filter Laporan', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Step 3: Panel memuat dropdown Tingkat Keparahan
    const severitySelect = page.locator('select').filter({ hasText: /Semua/ }).first();
    await expect(severitySelect).toBeVisible({ timeout: 10_000 });

    // Step 4: Pilih opsi "ringan" dari dropdown Tingkat Keparahan
    await severitySelect.selectOption({ value: 'ringan' });

    // Step 5: Badge jumlah filter aktif muncul di tombol Filter (membuktikan filter teraplikasi)
    // MapFilterControl.tsx baris 61-64: activeCount dihitung dari severity !== 'all'
    await expect(filterBtn.locator('span').filter({ hasText: '1' })).toBeVisible({ timeout: 5_000 });

    // Step 6: Tutup panel filter dengan klik di luar, lalu akses legenda
    await page.mouse.click(800, 500);
    await expect(page.getByText('Filter Laporan', { exact: true })).not.toBeVisible({ timeout: 5_000 });

    // Step 7: Tombol info legenda (Level Banjir) tersedia dan dapat diklik
    const infoBtn = page.getByTitle(/Level Banjir/i).first();
    await expect(infoBtn).toBeVisible({ timeout: 15_000 });
    await infoBtn.click();

    // Step 8: Konten legenda (label severity) tampil — legenda dapat diakses
    await expect(page.getByText(/Ringan|Sedang|Berat|Status Area|Level Banjir/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('TC-25: [NEGATIVE] Tombol info legenda dapat ditutup kembali (toggle dua kali)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });

    // ── Bagian 1: Legenda toggle (buka → tutup via klik tombol yang sama) ───
    const info = page.getByTitle(/Level Banjir/i).first();
    await expect(info).toBeVisible({ timeout: 15_000 });

    // Toggle pertama: buka legenda
    await info.click();
    await expect(page.getByText(/Ringan|Sedang|Berat|Status Area|Level Banjir/i).first()).toBeVisible({ timeout: 10_000 });

    // Toggle kedua: tutup legenda kembali
    await info.click();
    await expect(page.getByText(/Ringan|Sedang|Berat|Status Area|Level Banjir/i).first()).not.toBeVisible({ timeout: 5_000 });

    // ── Bagian 2: Panel filter tertutup otomatis saat klik di luar area ─────
    // Referensi: MapFilterControl.tsx baris 66-71 (mousedown outside listener)
    const filterBtn = page.getByRole('button', { name: /Filter/i }).first();
    await expect(filterBtn).toBeVisible({ timeout: 15_000 });
    await filterBtn.click();

    // Pastikan panel filter terbuka
    const filterPanel = page.getByText('Filter Laporan', { exact: true });
    await expect(filterPanel).toBeVisible({ timeout: 10_000 });

    // Klik di luar panel filter → panel menutup otomatis
    await page.mouse.click(800, 500);
    await expect(filterPanel).not.toBeVisible({ timeout: 5_000 });
  });
});
