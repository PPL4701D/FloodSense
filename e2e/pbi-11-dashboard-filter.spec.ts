import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-11 / FS-11 (Filter Dashboard: Wilayah + Waktu + Navigasi Admin).
 * Alur ala pengguna: pilih provinsi → kab/kota muncul, ganti preset waktu, navigasi
 * Admin Panel ↔ Dashboard. Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-11 — Filter Dashboard', () => {
  test('TC-03: pilih provinsi memunculkan dropdown kabupaten (cascading)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Wilayah', { exact: true })).toBeVisible();

    const prov = page.getByRole('combobox').first();
    await expect(prov).toBeVisible();
    await prov.selectOption({ label: 'Jawa Barat' });

    // Dropdown kabupaten/kota muncul (lazy-load) → minimal 2 combobox wilayah.
    await expect(page.getByRole('combobox').nth(1)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('TC-04: filter rentang waktu preset (30 hari) memperbarui dashboard', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Rentang Waktu')).toBeVisible();

    await page.getByRole('button', { name: '30 hari', exact: true }).click();

    // KPI tetap ter-render setelah ganti rentang (atau empty-state bila tanpa data).
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-05: navigasi Admin Panel lalu kembali ke dashboard', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: /Admin Panel/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await page.getByRole('link', { name: /Kembali ke Dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
  });
});
