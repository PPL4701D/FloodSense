import { test, expect, Page } from '@playwright/test';

/**
 * Sprint 2 — PBI-18 / FS-18 (Broadcast Pesan TLM).
 *
 * Push notification tidak bisa diuji via Playwright → verifikasi penerimaan lewat
 * NOTIFIKASI IN-APP (/notifications). Penerima broadcast = pelapor di wilayah target
 * + profil ber-assigned_region di wilayah itu. Akun penerima khusus (DB testing):
 *   bc.penerima@fs.id (assigned_region = "Kota Bandung") · password 123456.
 *
 * 2 positive (cross-account kirim→terima + kelola wilayah) + 4 negative/exception.
 */

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('123456');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

const SEARCH = /Cari provinsi \/ kabupaten \/ kecamatan/i;
const PESAN = /Contoh: Waspada potensi banjir/i;

test.describe('PBI-18 — Broadcast TLM', () => {

  // ============================ POSITIVE ============================

  test('P1 (TC-18): TLM kirim broadcast → akun penerima di wilayah itu MENERIMA notifikasi in-app', async ({ page, browser }) => {
    // --- Akun A: TLM menyusun & mengirim broadcast ---
    await loginAs(page, 'tlm@fs.id');
    await page.goto('/broadcast');
    await expect(page.getByRole('heading', { name: /Broadcast Peringatan/i })).toBeVisible({ timeout: 15_000 });
    // Pilih tingkat "Darurat".
    await page.getByRole('button', { name: 'Darurat' }).click();
    // Cari & pilih wilayah "Kota Bandung".
    await page.getByPlaceholder(SEARCH).fill('Kota Bandung');
    const opsi = page.locator('label').filter({ hasText: 'Kota Bandung' }).first();
    await expect(opsi).toBeVisible({ timeout: 15_000 });
    await opsi.getByRole('checkbox').check();
    // Ketik pesan unik & kirim.
    const pesan = `Uji broadcast E2E ${Date.now()}`;
    await page.getByPlaceholder(PESAN).fill(pesan);
    await page.getByRole('button', { name: /Kirim Broadcast/i }).click();
    await expect(page.getByText(/Broadcast terkirim ke/i)).toBeVisible({ timeout: 20_000 });

    // --- Akun B (jendela lain): penerima cek notifikasi in-app ---
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await loginAs(pageB, 'bc.penerima@fs.id');
    await pageB.goto('/notifications');
    // Notifikasi broadcast dengan pesan yang sama muncul.
    await expect(pageB.getByText(pesan)).toBeVisible({ timeout: 20_000 });
    await ctxB.close();
  });

  test('P2 (TC-19): cari, pilih, lalu hapus wilayah target', async ({ page }) => {
    await loginAs(page, 'tlm@fs.id');
    await page.goto('/broadcast');
    // Cari wilayah.
    await page.getByPlaceholder(SEARCH).fill('Bandung');
    const opsi = page.locator('label').filter({ hasText: /Bandung/i }).first();
    await expect(opsi).toBeVisible({ timeout: 15_000 });
    // Centang → chip wilayah terpilih muncul (counter "(1)").
    await opsi.getByRole('checkbox').check();
    await expect(page.getByText('(1)')).toBeVisible();
    // Klik X pada chip wilayah terpilih → pilihan kosong kembali.
    await page.locator('span > button').first().click();
    await expect(page.locator('span > button')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Broadcast Peringatan/i })).toBeVisible();
  });

  // ===================== NEGATIVE / EXCEPTION =====================

  test('N1 (TC-20): warga (non-TLM) dialihkan keluar dari /broadcast', async ({ page }) => {
    await loginAs(page, 'warga@fs.id');
    await page.goto('/broadcast');
    await expect(page).not.toHaveURL(/\/broadcast/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('N2 (TC-58): kirim tanpa memilih wilayah → "Pilih minimal satu wilayah"', async ({ page }) => {
    await loginAs(page, 'tlm@fs.id');
    await page.goto('/broadcast');
    await expect(page.getByRole('heading', { name: /Broadcast Peringatan/i })).toBeVisible({ timeout: 15_000 });
    // Isi pesan saja, tanpa memilih wilayah.
    await page.getByPlaceholder(PESAN).fill('Pesan tanpa memilih wilayah.');
    await page.getByRole('button', { name: /Kirim Broadcast/i }).click();
    await expect(page.getByText(/Pilih minimal satu wilayah/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Broadcast terkirim ke/i)).toHaveCount(0);
  });

  test('N3 (TC-59): wilayah dipilih tapi pesan kosong → "Pesan wajib diisi"', async ({ page }) => {
    await loginAs(page, 'tlm@fs.id');
    await page.goto('/broadcast');
    await page.getByPlaceholder(SEARCH).fill('Kota Bandung');
    const opsi = page.locator('label').filter({ hasText: 'Kota Bandung' }).first();
    await expect(opsi).toBeVisible({ timeout: 15_000 });
    await opsi.getByRole('checkbox').check();
    // Pesan dibiarkan kosong → kirim.
    await page.getByRole('button', { name: /Kirim Broadcast/i }).click();
    await expect(page.getByText(/Pesan wajib diisi/i)).toBeVisible({ timeout: 15_000 });
  });

  test('N4 (TC-60): pengiriman gagal (server 500) → error ditangani, tidak crash', async ({ page }) => {
    await loginAs(page, 'tlm@fs.id');
    await page.goto('/broadcast');
    await page.getByPlaceholder(SEARCH).fill('Kota Bandung');
    const opsi = page.locator('label').filter({ hasText: 'Kota Bandung' }).first();
    await expect(opsi).toBeVisible({ timeout: 15_000 });
    await opsi.getByRole('checkbox').check();
    await page.getByPlaceholder(PESAN).fill('Pesan uji gagal kirim.');
    // Simulasikan endpoint broadcast error 500.
    await page.route('**/api/broadcast', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server bermasalah (uji E2E)' }) })
    );
    await page.getByRole('button', { name: /Kirim Broadcast/i }).click();
    // Kotak error tampil; halaman tidak crash.
    await expect(page.getByText(/Server bermasalah \(uji E2E\)|Gagal mengirim broadcast/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Broadcast Peringatan/i })).toBeVisible();
  });
});
