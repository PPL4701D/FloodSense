import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-24 / FS-75 (NotificationBell Global + Akses Semua Role).
 * Bell di header untuk semua role, dropdown ringkas, akses /notifications.
 * Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-24 — NotificationBell Global', () => {
  test('TC-27: bell tampil untuk staf & halaman /notifications dapat diakses', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/');
    const bell = page.getByRole('button', { name: /notifikasi/i }).first();
    await expect(bell).toBeVisible({ timeout: 15_000 });

    await page.goto('/notifications');
    await expect(page).toHaveURL(/\/notifications/);
    await expect(page.getByRole('heading', { name: /Notifikasi/i })).toBeVisible({ timeout: 15_000 });
  });

  test('TC-28: klik bell membuka dropdown notifikasi', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    const bell = page.getByRole('button', { name: /notifikasi/i }).first();
    await expect(bell).toBeVisible({ timeout: 15_000 });
    await bell.click();
    // Dropdown memuat header/empty/tombol "Lihat semua".
    await expect(page.getByText(/Lihat semua|Belum ada notifikasi|Notifikasi/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('TC-29: halaman notifikasi (Lihat semua) dapat di-scroll', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/notifications');
    const scroller = page.locator('.notif-page');
    await expect(scroller).toBeVisible({ timeout: 15_000 });
    const overflow = await scroller.evaluate((el) => getComputedStyle(el).overflowY);
    expect(['auto', 'scroll']).toContain(overflow);
    // Bukti akhir terlihat.
    await expect(page.getByRole('heading', { name: /Notifikasi/i })).toBeVisible();
  });
});
