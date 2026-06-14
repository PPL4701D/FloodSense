import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { openFirstReport } from './helpers/nav';

/**
 * Sprint 2 — PBI-28 / FS-78 (Timeline Status & Riwayat Verifikasi).
 * Linimasa status di detail + timestamp WIB. Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-28 — Timeline Status Laporan', () => {
  test('TC-38: linimasa status tampil di detail laporan', async ({ page }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    await expect(page.getByText(/Linimasa Status/i).first()).toBeVisible({ timeout: 15_000 });
    // Event minimal "Dibuat" selalu ada pada timeline.
    await expect(page.getByText(/Dibuat/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('TC-39: timestamp linimasa memuat format WIB', async ({ page }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    await expect(page.getByText(/Linimasa Status/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/WIB/).first()).toBeVisible({ timeout: 15_000 });
  });
});
