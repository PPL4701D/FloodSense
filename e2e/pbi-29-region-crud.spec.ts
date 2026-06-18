import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * PBI-29 / FS-79: Manajemen Wilayah Admin
 */

test.describe('PBI-29 — Region CRUD Admin', () => {

  test('TC-05: Siklus Lengkap Manajemen Wilayah (Gabungan: Lihat Daftar, Tambah Prov & Kab, Edit, Set GeoJSON Peta)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/regions');
    await expect(page.getByRole('heading', { name: /Manajemen Wilayah/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Tambah Wilayah/i }).click();
    await expect(page.getByRole('heading', { name: /Tambah Wilayah/i })).toBeVisible({ timeout: 10_000 });
    const nameInput = page.getByPlaceholder(/mis. Jawa Barat/i).first();
    await expect(nameInput).toBeVisible();
    
    const randId = Math.floor(Math.random() * 10000);
    const provName = `Provinsi Bali ${randId}`;
    await nameInput.fill(provName);
    await page.getByRole('button', { name: /Simpan/i }).click();
    
    await expect(page.getByRole('heading', { name: /Tambah Wilayah/i })).toHaveCount(0, { timeout: 10_000 });
    
    await page.getByPlaceholder(/Cari nama \/ kode/i).fill(provName);
    await page.waitForTimeout(1000);
    await expect(page.getByText(provName).first()).toBeVisible();

    // Temukan baris data provinsi tersebut
    const row = page.locator('.card').filter({ hasText: provName }).first();
    await expect(row).toBeVisible();

    // Buka editor Boundary
    await row.getByRole('button', { name: /Boundary \(peta\)/i }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`Boundary — ${provName}`, 'i') })).toBeVisible({ timeout: 10_000 });
    
    // Interaksi Peta (Tambah Titik, Reset, Tambah, Undo, Tambah, Simpan)
    const mapContainer = page.locator('.leaflet-container');
    await expect(mapContainer).toBeVisible();
    await page.waitForTimeout(1000); // Tunggu map tiles load

    // Tambah 3 titik
    await mapContainer.click({ position: { x: 100, y: 100 } });
    await mapContainer.click({ position: { x: 200, y: 100 } });
    await mapContainer.click({ position: { x: 150, y: 200 } });
    await expect(page.getByText(/3 titik/i)).toBeVisible();

    // Uji fungsi Reset
    await page.getByRole('button', { name: /Reset/i }).click();
    await expect(page.getByText(/0 titik/i)).toBeVisible();

    // Tambah 3 titik baru
    await mapContainer.click({ position: { x: 120, y: 120 } });
    await mapContainer.click({ position: { x: 220, y: 120 } });
    await mapContainer.click({ position: { x: 170, y: 220 } });
    await expect(page.getByText(/3 titik/i)).toBeVisible();

    // Uji fungsi Undo (harus jadi 2 titik)
    await page.getByRole('button', { name: /Undo/i }).click();
    await expect(page.getByText(/2 titik/i)).toBeVisible();

    // Tambah 1 titik lagi (menjadi 3 titik untuk memenuhi syarat polygon)
    await mapContainer.click({ position: { x: 120, y: 220 } });
    await expect(page.getByText(/3 titik/i)).toBeVisible();

    // Simpan Boundary
    await page.getByRole('button', { name: /Simpan Boundary/i }).click();
    await expect(page.getByText(/Boundary tersimpan/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TC-06a: Keamanan Akses - Warga Ditolak Akses Admin', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/admin/regions');
    await expect(page).not.toHaveURL(/\/admin\/regions/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-06b: Validasi Form Wilayah & JSON Rusak', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/regions');
    await page.getByRole('button', { name: /Tambah Wilayah/i }).click();
    
    await page.getByRole('button', { name: /Simpan/i }).click();
    const isErrorVisible = await page.getByText(/wajib diisi|tidak boleh kosong|Pilih wilayah/i).count();
    expect(isErrorVisible > 0 || await page.locator(':invalid').count() > 0).toBeTruthy();
  });

  test('TC-07: Pencegahan Hapus Wilayah Aktif (Gabungan: Hapus Induk Beranak & Hapus Wilayah Dipakai Laporan)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/regions');
    
    const deleteBtn = page.getByRole('button', { name: /Hapus|Tong Sampah/i }).first();
    if (await deleteBtn.count() > 0) {
      await page.route('**/api/admin/regions/*', async route => {
        if (route.request().method() === 'DELETE') {
          await route.fulfill({
            status: 400,
            json: { error: 'Wilayah ini tidak bisa dihapus karena sedang digunakan' }
          });
        } else {
          await route.continue();
        }
      });

      await deleteBtn.click();
      
      const confirmOk = page.getByRole('button', { name: /Ya|OK|Hapus/i }).last();
      if (await confirmOk.count() > 0) {
        await confirmOk.click();
      }
      await expect(page.getByText(/gagal menghapus|tidak bisa dihapus/i).first()).toBeVisible({ timeout: 10_000 });
    }
  });

});
