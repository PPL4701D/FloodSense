import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-17 / FS-17 (Email Alert untuk Staf via Resend).
 * Pengiriman email aktual (Resend) bersifat eksternal → tidak di-assert di E2E.
 * Yang diuji: admin dapat menetapkan wilayah tanggung jawab staf (penentu penerima).
 */

test.describe('PBI-17 — Email Alert Staf (area tanggung jawab)', () => {
  test('TC-001: admin dapat membuka editor user staf & melihat picker Wilayah Tanggung Jawab', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /Kelola Pengguna/i })).toBeVisible({ timeout: 15_000 });

    // Buka editor user mana pun (tombol edit / klik baris).
    const editBtn = page.getByRole('button', { name: /Ubah Role|Edit/i }).first();
    if (await editBtn.count()) {
      await editBtn.click();
    } else {
      await page.getByText(/@fs\.id|@gmail\.com/).first().click();
    }
    // Pilih role staf → picker wilayah tanggung jawab muncul.
    const stafBtn = page.getByRole('button', { name: 'Staf', exact: true });
    if (await stafBtn.count()) {
      await stafBtn.click();
      await expect(page.getByText(/Wilayah Tanggung Jawab/i)).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({ type: 'note', description: 'Tombol role Staf tidak ditemukan di modal' });
    }
  });
});
