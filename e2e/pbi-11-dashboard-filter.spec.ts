import { test, expect, Page } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-11 / FS-11 (Filter Dashboard: Wilayah + Waktu + Navigasi Admin).
 * TC-03  : cascading wilayah (positive)
 * TC-04  : preset waktu 30 hari (positive)
 * TC-04-N: empty-state saat filter tanpa data (negative)
 * TC-05  : navigasi Admin Panel ↔ Dashboard (positive)
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

test.describe('PBI-11 — Filter Dashboard', () => {
  // ── TC-03 ──────────────────────────────────────────────────────────────────
  test('TC-03: pilih provinsi memunculkan dropdown kabupaten (cascading)', async ({ page }) => {
    await login(page, 'admin');
    await gotoDashboard(page);
    await expect(page.getByText('Wilayah', { exact: true })).toBeVisible();

    // Dropdown provinsi = <select> yang berisi option "Semua Provinsi"
    const prov = page.locator('select', { has: page.locator('option', { hasText: 'Semua Provinsi' }) });
    await expect(prov).toBeVisible();
    await prov.selectOption({ label: 'Jawa Barat' });

    // Dropdown kabupaten/kota muncul (lazy-load)
    const kab = page.locator('select', { has: page.locator('option', { hasText: 'Semua Kabupaten' }) });
    await expect(kab).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  // ── TC-04 ──────────────────────────────────────────────────────────────────
  test('TC-04: filter rentang waktu preset (30 hari) berfungsi', async ({ page }) => {
    await login(page, 'admin');
    await gotoDashboard(page);
    await expect(page.getByText('Rentang Waktu')).toBeVisible();

    await page.getByRole('button', { name: '30 hari', exact: true }).click();

    // KPI tetap ter-render setelah ganti rentang (atau empty-state bila tanpa data).
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });
  });

  // ── TC-04-N ────────────────────────────────────────────────────────────────
  test('TC-04-N: dashboard menampilkan empty-state saat filter wilayah + waktu tanpa data', async ({ page }) => {
    await login(page, 'admin');
    await gotoDashboard(page);

    // Pilih Bali
    const prov = page.locator('select', { has: page.locator('option', { hasText: 'Semua Provinsi' }) });
    await prov.selectOption({ label: 'Bali' });

    // Tunggu kabupaten muncul → pilih Kota Denpasar
    const kab = page.locator('select', { has: page.locator('option', { hasText: 'Semua Kabupaten' }) });
    await expect(kab).toBeVisible({ timeout: 10_000 });
    await kab.selectOption({ label: 'Kota Denpasar' });

    // Preset 30 hari
    await page.getByRole('button', { name: '30 hari', exact: true }).click();

    // Halaman tidak crash; empty-state tampil
    await expect(page.getByText(/Belum Ada Laporan/i).first()).toBeVisible({ timeout: 15_000 });

    // Heading tetap tampil
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  // ── TC-05 ──────────────────────────────────────────────────────────────────
  test('TC-05: navigasi Admin Panel lalu kembali ke dashboard', async ({ page }) => {
    await login(page, 'admin');
    await gotoDashboard(page);

    await page.getByRole('link', { name: /Admin Panel/i }).click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 15_000 });
    await page.getByRole('link', { name: /Kembali ke Dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
  });
});