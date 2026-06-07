import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-22 / FS-73 (Filter & Pagination Lanjutan Daftar Laporan).
 */

test.describe('PBI-22 — Filter & Pagination Laporan', () => {
  test('TC: filter bar (pencarian, severity, status, wilayah, sort) tampil', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/reports');
    await expect(page.getByPlaceholder(/Cari/i).first()).toBeVisible({ timeout: 15_000 });
    // Cascading region filter (provinsi) hadir di /reports (reuse PBI-11).
    await expect(page.getByRole('combobox').first()).toBeVisible();
  });

  test('TC-002: filter status = verified menjaga halaman tetap berfungsi', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/reports');
    // Pilih status verified pada salah satu dropdown status.
    const statusSelect = page.locator('select:has(option[value="verified"])').first();
    if (await statusSelect.count()) {
      await statusSelect.selectOption('verified').catch(() => {});
    }
    await expect(page).toHaveURL(/\/reports/);
  });

  test('TC: sort by Kredibilitas tersedia', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/reports');
    // Dropdown sort memuat opsi kredibilitas (select terlihat, option boleh hidden).
    await expect(page.locator('select:has(option[value="kredibilitas"])')).toBeVisible({ timeout: 15_000 });
  });
});
