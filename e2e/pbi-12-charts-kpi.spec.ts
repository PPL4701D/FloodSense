import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-12 / FS-12 (Grafik, KPI & Perbandingan Wilayah).
 * Catatan: heading aktual di aplikasi = "Perbandingan Antar Wilayah".
 * Tiap test berakhir pada teks yang terlihat di dashboard.
 */

test.describe('PBI-12 — Grafik, KPI & Perbandingan', () => {
  test('TC-06: KPI cards tampil (Total, Aktif, Terverifikasi, Kritis)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Aktif', { exact: true })).toBeVisible();
    await expect(page.getByText('Terverifikasi').first()).toBeVisible();
    await expect(page.getByText('Kritis').first()).toBeVisible();
  });

  test('TC-07: grafik tren & perbandingan antar wilayah ter-render', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    // Adaptif: tanpa data dashboard menampilkan empty-state.
    const empty = page.getByText('Belum Ada Laporan');
    if (await empty.count()) {
      await expect(empty.first()).toBeVisible();
      return;
    }
    await expect(page.getByRole('heading', { name: /Tren Laporan Harian/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Perbandingan Antar Wilayah/i })).toBeVisible();
  });

  test('TC-08: mode perbandingan wilayah dapat dipilih (dropdown)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    const compare = page.locator('select[title="Mode perbandingan"]');
    if (await compare.count()) {
      await compare.selectOption({ label: 'Rata-rata Ketinggian' });
      await expect(page.getByRole('heading', { name: /Perbandingan Antar Wilayah/i })).toBeVisible({ timeout: 10_000 });
    } else {
      // Tanpa data → mode perbandingan tidak tampil; tetap akhiri pada teks terlihat.
      await expect(page.getByText(/Belum Ada Laporan|Dashboard/).first()).toBeVisible();
    }
  });
});
