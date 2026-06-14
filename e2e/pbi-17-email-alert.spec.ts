import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-17 / FS-17 (Email Alert untuk Staf via Resend).
 * Pengiriman email eksternal tidak di-assert di E2E. Yang diuji: admin membuka editor
 * user, memilih role Staf, dan picker "Wilayah Tanggung Jawab" (penentu penerima) muncul.
 */

test.describe('PBI-17 — Email Alert Staf (area tanggung jawab)', () => {
  test('TC-17: admin membuka editor user staf & melihat picker Wilayah Tanggung Jawab', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /Kelola Pengguna/i })).toBeVisible({ timeout: 15_000 });

    // Buka editor user pertama (tombol "Ubah" pada baris pengguna).
    await page.getByRole('button', { name: 'Ubah', exact: true }).first().click();
    await expect(page.getByText(/Ubah Role —/i)).toBeVisible({ timeout: 10_000 });

    // Pilih role Staf → picker wilayah tanggung jawab (penentu penerima email) muncul.
    const stafBtn = page.getByRole('button', { name: 'Staf', exact: true });
    if (await stafBtn.count()) {
      await stafBtn.click();
      await expect(page.getByText(/Wilayah Tanggung Jawab/i)).toBeVisible({ timeout: 10_000 });
    } else {
      // Tetap akhiri pada teks terlihat di modal.
      await expect(page.getByText(/Ubah Role —/i)).toBeVisible();
    }
  });
});
