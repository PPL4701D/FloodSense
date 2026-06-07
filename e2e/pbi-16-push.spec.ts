import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-16 / FS-16 (Push Notification PWA).
 * Pengiriman push aktual & delivery tidak deterministik di E2E headless →
 * yang diuji: UI opt-in push tersedia di pengaturan notifikasi.
 */

test.describe('PBI-16 — Push Notification', () => {
  test('TC-001: opt-in push tersedia di /settings/notifications', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    await login(page, 'warga');
    await page.goto('/settings/notifications');
    await expect(page.getByText(/Notifikasi Perangkat|Push/i).first()).toBeVisible({ timeout: 15_000 });
    // Tombol Aktifkan/Matikan push hadir.
    await expect(page.getByRole('button', { name: /Aktifkan|Matikan/i }).first()).toBeVisible();
  });
});
