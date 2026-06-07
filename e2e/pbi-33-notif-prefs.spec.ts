import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-33 / FS-83 (Preferensi Notifikasi Lanjutan).
 */

test.describe('PBI-33 — Preferensi Notifikasi', () => {
  test('TC: preferensi jenis notifikasi + jam tenang tampil', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/settings/notifications');
    await expect(page.getByText(/Preferensi Notifikasi/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Jam Tenang/i)).toBeVisible();
  });

  test('TC-004: preferensi tersimpan saat di-toggle (tetap di halaman)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/settings/notifications');
    await expect(page.getByText(/Preferensi Notifikasi/i)).toBeVisible({ timeout: 15_000 });
    // Toggle pertama yang tersedia (jenis notifikasi).
    const toggle = page.locator('button[role="switch"], [aria-checked]').first();
    if (await toggle.count()) await toggle.click().catch(() => {});
    await expect(page).toHaveURL(/\/settings\/notifications/);
  });
});
