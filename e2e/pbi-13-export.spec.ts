import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-13 / FS-13 (Ekspor Data CSV & PDF).
 * Mengunduh CSV sungguhan (assert nama berkas), lalu memastikan tombol PDF ada.
 * Tiap test berakhir pada teks yang terlihat (judul Dashboard).
 */

test.describe('PBI-13 — Ekspor CSV & PDF', () => {
  test('TC-09: ekspor CSV mengunduh berkas .csv', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });

    const csvBtn = page.getByRole('button', { name: /CSV/i }).first();
    if (!(await csvBtn.count())) {
      test.skip(true, 'Toolbar ekspor tidak tersedia (tanpa data)');
    }
    await expect(csvBtn).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }),
      csvBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);

    // Bukti akhir terlihat: tetap di dashboard.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('TC-10: tombol ekspor PDF tersedia', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('button', { name: /PDF/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});
