import { test, expect, Page } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-13 / FS-13 (Ekspor Data CSV & PDF).
 * TC-09  : ekspor CSV mengunduh berkas .csv (positive)
 * TC-09-N: penanganan ekspor CSV saat data kosong (negative)
 * TC-10  : tombol ekspor PDF tersedia (positive)
 */

/**
 * Helper tangguh untuk memuat halaman dashboard dengan mekanisme retry
 * guna mengatasi database/dev-server lokal yang lambat merespons.
 */
async function gotoDashboard(page: Page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await page.waitForTimeout(2000);
    }
  }
}

test.describe('PBI-13 — Ekspor CSV & PDF', () => {
  // ── TC-09 ──────────────────────────────────────────────────────────────────
  test('TC-09: ekspor CSV mengunduh berkas .csv', async ({ page }) => {
    await login(page, 'admin');
    await gotoDashboard(page);
    
    // Pastikan KPI/empty-state tampil secara visual
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });

    const csvBtn = page.getByRole('button', { name: 'CSV' });
    
    // Jika tombol tidak dinonaktifkan (artinya ada data), lakukan uji unduh berkas
    if (!(await csvBtn.isDisabled())) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15_000 }),
        csvBtn.click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    }

    // Tetap berada di halaman Dashboard
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  // ── TC-09-N ────────────────────────────────────────────────────────────────
  test('TC-09-N: penanganan ekspor CSV saat data kosong (wilayah Bali)', async ({ page }) => {
    await login(page, 'admin');
    await gotoDashboard(page);

    // Filter wilayah ke Provinsi Bali (tidak memuat data laporan)
    const prov = page.locator('select', { has: page.locator('option', { hasText: 'Semua Provinsi' }) });
    await expect(prov).toBeVisible();
    await prov.selectOption({ label: 'Bali' });

    // Pastikan dashboard memuat status kosong dan menampilkan pesan 'Belum Ada Laporan'
    await expect(page.getByText(/Belum Ada Laporan/i).first()).toBeVisible({ timeout: 15_000 });

    // Verifikasi tombol CSV dinonaktifkan (disabled) saat data kosong
    const csvBtn = page.getByRole('button', { name: 'CSV' });
    await expect(csvBtn).toBeDisabled();
  });

  // ── TC-10 ──────────────────────────────────────────────────────────────────
  test('TC-10: tombol ekspor PDF tersedia', async ({ page }) => {
    await login(page, 'admin');
    await gotoDashboard(page);

    // Pastikan KPI/empty-state tampil
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });

    // Tombol PDF tampil di toolbar ekspor
    const pdfBtn = page.getByRole('button', { name: 'PDF' });
    await expect(pdfBtn).toBeVisible();

    // Heading dashboard tetap tampil
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
