import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-11 / FS-11 (Filter Dashboard: Wilayah + Waktu).
 * Test Cases dari Jira: cascading region, filter wilayah, date range.
 */

test.describe('PBI-11 — Filter Dashboard', () => {
  test('TC-001: pilih provinsi memunculkan dropdown kabupaten (cascading)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    const prov = page.getByRole('combobox').first();
    await expect(prov).toBeVisible();
    await prov.selectOption({ label: 'Jawa Barat' });
    // Dropdown kabupaten/kota muncul setelah provinsi dipilih (lazy-load).
    await expect(page.getByRole('combobox').nth(1)).toBeVisible({ timeout: 15_000 });
  });

  test('TC-003: filter rentang waktu (preset 7/30 hari) tersedia & dapat diklik', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Rentang Waktu')).toBeVisible();
    await page.getByRole('button', { name: '30 hari', exact: true }).click();
    // KPI tetap ter-render setelah ganti rentang waktu.
    await expect(page.getByText('Total Laporan')).toBeVisible();
  });

  test('navigasi: tombol Admin Panel ada untuk admin & kembali dari /admin', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /Admin Panel/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await page.getByRole('link', { name: /Kembali ke Dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});
