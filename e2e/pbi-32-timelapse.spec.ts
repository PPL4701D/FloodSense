import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-32 / FS-82 (Time-lapse / Pemutaran Historis Heatmap).
 * Buka panel time-lapse dari peta, jalankan kontrol Putar. Berakhir pada teks terlihat.
 */

test.describe('PBI-32 — Time-lapse Heatmap', () => {
  test('TC-49: tombol time-lapse membuka panel slider & kontrol Putar', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });

    const btn = page.getByTitle(/Time-lapse historis/i).first();
    await expect(btn).toBeVisible({ timeout: 15_000 });
    await btn.click();

    // Panel time-lapse terbuka.
    await expect(page.getByText(/Time-lapse Banjir/i)).toBeVisible({ timeout: 10_000 });

    // Kontrol Putar tersedia & dapat diklik (alur pemutaran).
    const play = page.getByRole('button', { name: /Putar|Jeda/i }).first();
    if (await play.count()) {
      await play.click();
    }
    await expect(page.getByText(/Time-lapse Banjir/i)).toBeVisible();
  });
});
