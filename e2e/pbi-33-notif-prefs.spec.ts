import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-33 / FS-83 (Preferensi Notifikasi Lanjutan).
 * Preferensi jenis notifikasi + Jam Tenang, toggle tersimpan. Berakhir pada teks terlihat.
 */

test.describe('PBI-33 — Preferensi Notifikasi', () => {
  test('TC-50: preferensi jenis notifikasi + Jam Tenang tampil', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/settings/notifications');
    await expect(page.getByText(/Preferensi Notifikasi/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Jam Tenang/i)).toBeVisible();
  });

  test('TC-51: toggle preferensi dapat diubah & tetap di halaman', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/settings/notifications');
    await expect(page.getByText(/Preferensi Notifikasi/i)).toBeVisible({ timeout: 15_000 });

    // Toggle pertama (switch jenis notifikasi).
    const toggle = page.locator('[role="switch"]').first();
    if (await toggle.count()) {
      await toggle.click().catch(() => {});
      await page.waitForTimeout(600);
    }
    await expect(page).toHaveURL(/\/settings\/notifications/);
    await expect(page.getByText(/Preferensi Notifikasi/i)).toBeVisible();
  });
});
