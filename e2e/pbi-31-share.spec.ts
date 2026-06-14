import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { openFirstReport } from './helpers/nav';

/**
 * Sprint 2 — PBI-31 / FS-81 (Bagikan Laporan + OG Image).
 * navigator.share dinonaktifkan agar fallback (copy + WA/Telegram) deterministik.
 * Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-31 — Bagikan Laporan', () => {
  test('TC-47: tombol Bagikan membuka fallback (salin tautan + sosial)', async ({ page }) => {
    // Paksa fallback: hapus Web Share API sebelum halaman dimuat.
    await page.addInitScript(() => {
      // @ts-expect-error override untuk uji fallback
      delete (navigator as Navigator).share;
    });
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    const shareBtn = page.getByRole('button', { name: /Bagikan/i }).first();
    await expect(shareBtn).toBeVisible({ timeout: 15_000 });
    await shareBtn.click();

    // Menu fallback memuat opsi salin tautan / kanal sosial.
    await expect(page.getByText(/Salin tautan|Tautan disalin|WhatsApp|Telegram/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('TC-48: OG image route laporan mengembalikan gambar', async ({ page, request }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    const url = page.url();
    const id = url.split('/report/')[1]?.split(/[/?#]/)[0];
    test.skip(!id, 'ID laporan tidak terbaca');
    const res = await request.get(`/report/${id}/opengraph-image`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');

    // Bukti akhir terlihat: detail laporan tetap terbuka.
    await expect(page.getByText(/Detail Laporan/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
