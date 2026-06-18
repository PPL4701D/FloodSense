import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { openFirstReport } from './helpers/nav';

/**
 * Sprint 2 — PBI-31 / FS-81 (Bagikan Laporan + OG Image).
 * navigator.share dinonaktifkan agar fallback (copy + WA/Telegram) deterministik.
 * Tiap test berakhir pada teks yang terlihat.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TC-47 — PBI-31 / FS-81  [Positive]
// Skenario   : Tombol Bagikan & OG Image laporan berfungsi
// ─────────────────────────────────────────────────────────────────────────────
// TC-48 — PBI-31 / FS-81  [Negative]
// Skenario   : Salin tautan gagal karena permission clipboard diblokir — tidak ada feedback ke user
// ─────────────────────────────────────────────────────────────────────────────

test.describe('PBI-31 — Bagikan Laporan', () => {
  test('TC-47: [POSITIVE] Tombol Bagikan & OG Image laporan berfungsi', async ({ page, request }) => {
    // Paksa fallback: hapus Web Share API sebelum halaman dimuat.
    await page.addInitScript(() => {
      // @ts-expect-error override untuk uji fallback
      delete (navigator as Navigator).share;
    });
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    // Bagian 1: Tombol Bagikan membuka fallback (salin tautan + sosial)
    const shareBtn = page.getByRole('button', { name: /Bagikan/i }).first();
    await expect(shareBtn).toBeVisible({ timeout: 15_000 });
    await shareBtn.click();

    // Menu fallback memuat opsi salin tautan / kanal sosial.
    await expect(page.getByText(/Salin tautan|Tautan disalin|WhatsApp|Telegram/i).first()).toBeVisible({ timeout: 10_000 });

    // Bagian 2: OG image route laporan mengembalikan gambar
    const url = page.url();
    const id = url.split('/report/')[1]?.split(/[/?#]/)[0];
    test.skip(!id, 'ID laporan tidak terbaca');
    const res = await request.get(`/report/${id}/opengraph-image`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');

    // Bukti akhir terlihat: detail laporan tetap terbuka.
    await expect(page.getByText(/Detail Laporan/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-48: [NEGATIVE] Salin tautan gagal karena permission clipboard diblokir — tidak ada feedback ke user', async ({ page }) => {
    // Nonaktifkan Web Share API via prototype override agar deterministic di Chromium
    // (delete navigator.share pada instance tidak cukup karena share ada di prototype chain)
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'share', {
        get: () => undefined,
        configurable: true,
      });
      // Override clipboard.writeText agar selalu reject — simulasi permission ditolak
      Object.defineProperty(Navigator.prototype, 'clipboard', {
        get: () => ({
          writeText: () => Promise.reject(new DOMException('NotAllowedError', 'NotAllowedError')),
        }),
        configurable: true,
      });
    });

    // Login sebagai warga, buka detail laporan pertama
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    // Scroll ke atas agar tombol Bagikan (pojok kanan atas header) terlihat
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);

    // Tombol Bagikan: aria-label="Bagikan" / title="Bagikan laporan" — ShareButton.tsx baris 75-76
    const shareBtn = page.locator('[aria-label="Bagikan"], [title="Bagikan laporan"]').first();
    await expect(shareBtn).toBeVisible({ timeout: 15_000 });
    await shareBtn.click();
    await page.waitForTimeout(400); // beri waktu panel animasi muncul

    // Pastikan fallback panel terbuka — tombol "Salin tautan" harus terlihat
    // (karena navigator.share = undefined → handleClick tidak memanggil Web Share, langsung setOpen(true))
    const salinBtn = page.getByRole('button', { name: /Salin tautan/i });
    await expect(salinBtn).toBeVisible({ timeout: 10_000 });

    // Klik "Salin tautan" — clipboard.writeText() akan reject (DOMException: NotAllowedError)
    await salinBtn.click();

    // Expected Result: TIDAK ada pesan error yang muncul ke pengguna
    // catch block di ShareButton.tsx baris 59 adalah: catch { /* ignore */ }
    await expect(page.getByText(/Gagal menyalin|clipboard error|Tidak bisa/i)).not.toBeVisible({ timeout: 3_000 });

    // Tombol TIDAK berubah jadi "Tautan disalin!" karena copy gagal
    await expect(page.getByRole('button', { name: /Tautan disalin/i })).not.toBeVisible({ timeout: 3_000 });

    // Panel fallback masih terbuka — tidak ada crash yang menutup UI
    await expect(page.getByText(/WhatsApp|Telegram/i).first()).toBeVisible({ timeout: 5_000 });
  });
});

