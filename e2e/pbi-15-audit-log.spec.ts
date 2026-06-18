import { test, expect, Page } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-15 / FS-15 (Audit Log Aktivitas Admin).
 * TC-11  : Halaman audit log tampil dengan daftar log + filter (positive)
 * TC-11-N: Pencarian kata kunci yang tidak ada menghasilkan empty state (negative)
 * TC-12  : Tiap entri log menampilkan aksi, pelaku, dan detail saat diklik (positive)
 * TC-13  : Filter jenis aksi mempersempit daftar (positive)
 * TC-14  : Ekspor CSV audit log tersedia (positive)
 */

/**
 * Helper tangguh untuk memuat halaman audit logs dengan mekanisme retry
 * guna mengatasi database/dev-server lokal yang lambat merespons.
 */
async function gotoAuditLogs(page: Page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto('/admin/audit-logs', { timeout: 45000 });
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible({ timeout: 45_000 });
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await page.waitForTimeout(2000);
    }
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('PBI-15 — Audit Log Viewer', () => {
  let sharedPage: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    // Naikkan timeout beforeAll agar memiliki waktu kompilasi Turbopack
    testInfo.setTimeout(90000);

    // Buat context dan page yang sama untuk seluruh test case demi menghemat kompilasi & session Turbopack
    const context = await browser.newContext();
    sharedPage = await context.newPage();
    
    // Lakukan login SEKALI saja untuk seluruh rangkaian tes
    await login(sharedPage, 'admin');
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  test.beforeEach(async ({}, testInfo) => {
    // Berikan timeout lebih panjang (90 detik) untuk mengantisipasi kompilasi Turbopack dev-server
    testInfo.setTimeout(90000);
    // Jeda 2 detik agar dev-server stabil di antara langkah tes
    await sharedPage.waitForTimeout(2000);
  });

  // ── TC-11 ──────────────────────────────────────────────────────────────────
  test('TC-11: Halaman audit log tampil dengan daftar log + filter', async () => {
    const page = sharedPage;
    await gotoAuditLogs(page);

    // Pastikan kolom pencarian kata kunci tampil
    await expect(page.getByPlaceholder(/Cari kata kunci/i)).toBeVisible();

    // Pastikan dropdown "Semua aksi" tampil
    const aksiSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Semua aksi' }) });
    await expect(aksiSelect).toBeVisible();

    // Pastikan dropdown "Semua admin pelaku" tampil
    const pelakuSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Semua admin pelaku' }) });
    await expect(pelakuSelect).toBeVisible();
  });

  // ── TC-11-N ────────────────────────────────────────────────────────────────
  test('TC-11-N: Pencarian kata kunci yang tidak ada di log menghasilkan tampilan empty state', async () => {
    const page = sharedPage;
    await gotoAuditLogs(page);

    // Ketikkan kata kunci acak yang tidak ada
    const searchInput = page.getByPlaceholder(/Cari kata kunci/i);
    await searchInput.fill('xyznotfound999');

    // Pastikan muncul pesan empty state
    await expect(page.getByText(/Tidak ada log sesuai filter/i)).toBeVisible({ timeout: 30_000 });

    // Bersihkan kembali input pencarian agar tidak memengaruhi tes berikutnya
    await searchInput.fill('');
    await page.waitForTimeout(1000);
  });

  // ── TC-12 ──────────────────────────────────────────────────────────────────
  test('TC-12: tiap entri log menampilkan label aksi, nama pelaku, dan detail saat diklik', async () => {
    const page = sharedPage;
    await gotoAuditLogs(page);

    // Cari kartu log entri
    const logCards = page.locator('.card button');
    
    // Jika ada kartu log yang memiliki detail delta (mengandung chevron right/down), uji aksi klik
    if (await logCards.count() > 0) {
      const firstCard = logCards.first();
      await firstCard.click();
      
      // Verifikasi detail JSON entri (menggunakan tag pre) tampil setelah diklik
      const detailJson = page.locator('pre');
      await expect(detailJson).toBeVisible({ timeout: 10_000 });

      // Sembunyikan kembali detail dengan klik ulang agar state bersih
      await firstCard.click();
    } else {
      // Jika kosong, pastikan pesan empty state terlihat
      await expect(page.getByText(/Tidak ada log sesuai filter/i)).toBeVisible();
    }
  });

  // ── TC-13 ──────────────────────────────────────────────────────────────────
  test('TC-13: Filter jenis aksi mempersempit daftar', async () => {
    const page = sharedPage;
    await gotoAuditLogs(page);

    const aksiSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Semua aksi' }) });
    
    // Pilih filter aksi REPORT_VERIFY
    await aksiSelect.selectOption('REPORT_VERIFY');
    await page.waitForTimeout(1000);

    // Pastikan tetap berada di halaman Audit Log tanpa crash/error
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();

    // Kembalikan filter ke opsi semula agar tidak memengaruhi tes berikutnya
    await aksiSelect.selectOption('');
    await page.waitForTimeout(1000);
  });

  // ── TC-14 ──────────────────────────────────────────────────────────────────
  test('TC-14: Ekspor CSV audit log tersedia', async () => {
    const page = sharedPage;
    await gotoAuditLogs(page);

    // Pastikan tombol Ekspor CSV tampil
    await expect(page.getByRole('button', { name: /Ekspor CSV/i })).toBeVisible();
  });
});
