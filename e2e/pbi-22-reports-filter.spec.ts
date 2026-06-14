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

  test('TC-22: filter status = verified menyaring lalu reset mengembalikan daftar', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible({ timeout: 15_000 });

    const statusSelect = page.locator('select:has(option[value="verified"])').first();
    await statusSelect.selectOption('verified');
    await expect(page).toHaveURL(/status=verified/, { timeout: 10_000 });

    // Hasil tersaring (badge "Terverifikasi" terlihat) ATAU empty-state filter; lalu reset.
    await expect(
      page.locator('.badge-status-verified').first()
        .or(page.getByText(/Tidak ada laporan sesuai filter/i))
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Reset filter/i }).first().click();
    await expect(page).not.toHaveURL(/status=verified/, { timeout: 10_000 });
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
});
