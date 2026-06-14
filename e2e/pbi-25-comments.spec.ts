import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { openFirstReport } from './helpers/nav';

/**
 * Sprint 2 — PBI-25 / FS-76 (Komentar & Diskusi pada Laporan).
 * Bagian Diskusi di detail laporan + kirim komentar (optimistic).
 * Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-25 — Komentar Laporan', () => {
  test('TC-30: user login melihat bagian Diskusi + form komentar', async ({ page }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    await expect(page.getByText(/Diskusi/i).first()).toBeVisible({ timeout: 15_000 });
    // Form komentar (textarea) tersedia untuk user login.
    await expect(page.getByPlaceholder(/Tambahkan informasi atau konfirmasi kondisi/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TC-31: kirim komentar tampil optimistic di daftar', async ({ page }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    const box = page.getByPlaceholder(/Tambahkan informasi atau konfirmasi kondisi/i);
    await box.scrollIntoViewIfNeeded();
    const msg = `Komentar uji E2E ${Date.now()}`;
    await box.fill(msg);
    await page.getByRole('button', { name: /Kirim/i }).first().click();

    // Komentar baru langsung tampil (teks unik terlihat di halaman).
    await expect(page.getByText(msg)).toBeVisible({ timeout: 15_000 });
  });
});
