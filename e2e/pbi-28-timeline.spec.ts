import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { openFirstReport } from './helpers/nav';

/**
 * Sprint 2 — PBI-28 / FS-78 (Timeline Status & Riwayat Verifikasi).
 */

test.describe('PBI-28 — Timeline Status Laporan', () => {
  test('TC: linimasa status tampil di detail laporan', async ({ page }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');
    // Event minimal "Dibuat" selalu ada pada timeline.
    await expect(page.getByText(/Linimasa|Riwayat Status|Dibuat/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-005: timestamp memuat format WIB', async ({ page }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');
    await expect(page.getByText(/WIB/).first()).toBeVisible({ timeout: 15_000 });
  });
});
