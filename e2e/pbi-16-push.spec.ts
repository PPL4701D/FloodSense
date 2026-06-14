import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-16 / FS-16 (Push Notification PWA).
 * Pengiriman push aktual tidak deterministik di E2E headless → diuji alur opt-in:
 * izin notifikasi diberikan, bagian "Notifikasi Perangkat (Push)" + tombol Aktifkan tampil.
 */

test.describe('PBI-16 — Push Notification', () => {
  test('TC-16: opt-in push tersedia & dapat diakses di /settings/notifications', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await login(page, 'warga');
    await page.goto('/settings/notifications');

    // Bagian push perangkat tampil.
    await expect(page.getByText(/Notifikasi Perangkat \(Push\)/i)).toBeVisible({ timeout: 15_000 });

    // Tombol opt-in/opt-out hadir (Aktifkan / Matikan).
    const toggleBtn = page.getByRole('button', { name: /Aktifkan|Matikan/i }).first();
    await expect(toggleBtn).toBeVisible();

    // Bagian preferensi notifikasi juga ada di halaman yang sama.
    await expect(page.getByText(/Preferensi Notifikasi/i)).toBeVisible();
  });
});
