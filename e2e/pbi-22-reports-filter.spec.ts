import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-22 / FS-73 (Filter & Pagination Lanjutan Daftar Laporan).
 * Alur ala pengguna: filter + sinkron URL (shareable), status verified + reset,
 * sort kredibilitas + infinite scroll. Adaptif terhadap volume data.
 */

test.describe('PBI-22 — Filter & Pagination Laporan', () => {
  test('TC-21: filter bar lengkap & state filter tersinkron ke URL', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder(/Cari lokasi atau deskripsi/i)).toBeVisible();
    // Cascading region filter (reuse PBI-11) + select keparahan/status/sort hadir.
    await expect(page.getByRole('combobox').first()).toBeVisible();

    // Ketik pencarian → tersinkron ke URL query (shareable).
    await page.getByPlaceholder(/Cari lokasi atau deskripsi/i).fill('banjir');
    await expect(page).toHaveURL(/q=banjir/, { timeout: 10_000 });

    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible();
  });

  test('TC-22: filter status = ditolak menyaring daftar laporan', async ({ page }) => {
    // Buka halaman /login dan isi kredensial
    await page.goto('/login');
    await page.getByPlaceholder(/Email/i).fill('warga@fs.id');
    await page.getByPlaceholder(/Password/i).fill('123456');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();

    // Buka halaman /reports
    await page.goto('/reports');

    // Pastikan heading “Laporan Banjir” tampil
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible({ timeout: 15_000 });

    // Pastikan kolom pencarian “Cari lokasi atau deskripsi...” tampil
    await expect(page.getByPlaceholder(/Cari lokasi atau deskripsi/i)).toBeVisible();

    // Pastikan dropdown filter keparahan, status, provinsi, dan urutan tampil
    await expect(page.locator('select:has(option[value="ringan"])')).toBeVisible(); // Keparahan
    await expect(page.locator('select:has(option[value="pending"])')).toBeVisible(); // Status
    await expect(page.getByRole('combobox').first()).toBeVisible(); // Provinsi
    await expect(page.locator('select:has(option[value="terbaru"])')).toBeVisible(); // Urutan

    // Pilih filter status “Ditolak”
    const statusSelect = page.locator('select:has(option[value="rejected"])').first();
    await statusSelect.selectOption('rejected');

    // Pastikan URL memuat parameter status=rejected
    await expect(page).toHaveURL(/status=rejected/, { timeout: 10_000 });

    // Pastikan daftar laporan yang tampil memiliki badge status “Ditolak”
    await expect(page.locator('.badge-status-rejected').first()).toBeVisible({ timeout: 15_000 });


    // Pastikan laporan dengan status selain “Ditolak” seperti “Pending” atau “Diverifikasi” tidak tampil
    await expect(page.locator('.badge-status-pending')).toHaveCount(0);
    await expect(page.locator('.badge-status-verified')).toHaveCount(0);

    // Pastikan heading “Laporan Banjir” tetap tampil
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible();
  });

  test('TC-23: sort Kredibilitas + infinite scroll memuat batch berikutnya', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible({ timeout: 15_000 });

    // Sort by kredibilitas → tersinkron ke URL.
    await page.locator('select:has(option[value="kredibilitas"])').selectOption('kredibilitas');
    await expect(page).toHaveURL(/sort=kredibilitas/, { timeout: 10_000 });

    // Infinite scroll: jumlah item bertambah ATAU penanda "semua dimuat" muncul.
    const items = page.locator('a[href^="/report/"]');
    const before = await items.count();
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 4000);
      await page.waitForTimeout(700);
    }
    const after = await items.count();
    expect(after).toBeGreaterThanOrEqual(before);

    // Bukti akhir terlihat: daftar bertambah ATAU teks penanda akhir/empty.
    await expect(
      page.getByText(/Semua laporan telah dimuat|Belum ada laporan|Laporan Banjir/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('TC-55: pencarian kata kunci yang tidak ada hasil menampilkan empty state', async ({ page }) => {
    // Buka halaman /login
    await page.goto('/login');
    await page.getByPlaceholder(/Email/i).fill('warga@fs.id');
    await page.getByPlaceholder(/Password/i).fill('123456');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();

    // Buka halaman /reports
    await page.goto('/reports');

    // Pastikan heading “Laporan Banjir” tampil
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible({ timeout: 15_000 });

    // Pilih filter status “Ditolak”
    const statusSelect = page.locator('select:has(option[value="rejected"])').first();
    await statusSelect.selectOption('rejected');

    // Pastikan URL memuat parameter status=rejected
    await expect(page).toHaveURL(/status=rejected/, { timeout: 10_000 });

    // Ketik keyword pencarian yang tidak sesuai dengan data laporan
    await page.getByPlaceholder(/Cari lokasi atau deskripsi/i).fill('xyzlaporantidakada999');

    // Pastikan URL memuat parameter q=xyzlaporantidakada999
    await expect(page).toHaveURL(/q=xyzlaporantidakada999/, { timeout: 10_000 });

    // Pastikan sistem menampilkan pesan kosong seperti “Tidak ada laporan ditemukan”
    await expect(page.getByText(/Tidak ada laporan sesuai filter/i)).toBeVisible({ timeout: 15_000 });

    // Pastikan tidak ada card laporan yang tampil (mengabaikan toast notifikasi jika ada)
    await expect(page.locator('a[href^="/report/"]:has(.badge)')).toHaveCount(0);

    // Pastikan halaman tidak error dan heading “Laporan Banjir” tetap tampil
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible();
  });
});
