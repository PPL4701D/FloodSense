import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-24 / FS-75 (NotificationBell Global + Akses Semua Role).
 */

test.describe('PBI-24 — NotificationBell Global', () => {
  test('TC-004: bell tampil di header untuk staf & /notifications dapat diakses', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/');
    // Lonceng notifikasi di header (tombol dengan ikon bell).
    const bell = page.getByRole('button', { name: /notifikasi/i });
    await expect(bell.first()).toBeVisible({ timeout: 15_000 });
    await page.goto('/notifications');
    await expect(page).toHaveURL(/\/notifications/);
    await expect(page.getByRole('heading', { name: /Notifikasi/i })).toBeVisible({ timeout: 15_000 });
  });

  test('klik bell membuka dropdown notifikasi', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/');
    const bell = page.getByRole('button', { name: /notifikasi/i }).first();
    await bell.click();
    // Dropdown memuat judul atau tombol "Lihat semua".
    await expect(page.getByText(/Lihat semua|Notifikasi|Belum ada/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('halaman notifikasi (lihat semua) bisa di-scroll', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/notifications');
    const scroller = page.locator('.notif-page');
    await expect(scroller).toBeVisible({ timeout: 15_000 });
    const overflow = await scroller.evaluate((el) => getComputedStyle(el).overflowY);
    expect(['auto', 'scroll']).toContain(overflow);
  });
});
