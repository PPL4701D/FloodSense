import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { openFirstReport } from './helpers/nav';

/**
 * Sprint 2 — PBI-25 / FS-76 (Komentar & Diskusi pada Laporan).
 */

test.describe('PBI-25 — Komentar Laporan', () => {
  test('TC-002: user login melihat bagian Diskusi + form komentar', async ({ page }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');
    await expect(page.getByText(/Diskusi|Komentar/i).first()).toBeVisible({ timeout: 15_000 });
    // Form komentar (textarea) tersedia untuk user login.
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 });
  });

  test('TC: kirim komentar tersimpan (optimistic)', async ({ page }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');
    const box = page.locator('textarea').first();
    await box.scrollIntoViewIfNeeded();
    const msg = `Komentar uji E2E ${Date.now()}`;
    await box.fill(msg);
    await page.getByRole('button', { name: /Kirim|Komentar/i }).first().click();
    await expect(page.getByText(msg)).toBeVisible({ timeout: 15_000 });
  });
});
