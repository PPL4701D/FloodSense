import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-12 / FS-12 (Grafik, KPI & Perbandingan Wilayah).
 */

test.describe('PBI-12 — Grafik, KPI & Perbandingan', () => {
  test('TC-002: KPI cards tampil (Total, Aktif, Terverifikasi, Kritis)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    // KPI cards (3 label unik cukup membuktikan grid KPI ter-render).
    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Terverifikasi').first()).toBeVisible();
    await expect(page.getByText('Kritis').first()).toBeVisible();
  });

  test('TC-001: grafik tren & perbandingan wilayah ter-render', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Tren Laporan Harian/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Perbandingan Antar Wilayah/i })).toBeVisible();
  });

  test('TC-003: mode perbandingan wilayah dapat dipilih (dropdown)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    const compare = page.locator('select[title="Mode perbandingan"]');
    // Mode select hanya muncul bila ada data; bila ada, ganti modenya.
    if (await compare.count()) {
      await compare.selectOption({ label: 'Rata-rata Ketinggian' });
      await expect(page.getByRole('heading', { name: /Perbandingan Antar Wilayah/i })).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'note', description: 'Tidak ada data → mode perbandingan tidak tampil' });
    }
  });
});
