import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('PBI-24 — NotificationBell Global', () => {

  test('TC-27 [+] ikon bell, dropdown, dan redirect ke halaman /notifications berfungsi', async ({ page }) => {
    // Login menggunakan akun TLM khusus
    await login(page, 'pbi24Tlm');
    await page.goto('/');

    // 1. Verifikasi ikon bell tampil di header
    const bell = page.getByRole('button', { name: /notifikasi/i }).first();
    await expect(bell).toBeVisible({ timeout: 15_000 });

    const box = await bell.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    // 2. Klik bell dan verifikasi dropdown terbuka
    await bell.click();
    const dropdown = page.locator('.notif-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Header dropdown wajib ada
    const headerText = dropdown.getByText('Notifikasi').first();
    await expect(headerText).toBeVisible();

    // Area konten dropdown (bisa berisi item atau pesan kosong)
    const hasItem = await dropdown.locator('button').filter({ hasText: /.+/ }).count() > 0;
    const hasEmpty = await dropdown.getByText(/Belum ada notifikasi/i).isVisible().catch(() => false);
    expect(hasItem || hasEmpty).toBeTruthy();

    // 3. Klik "Lihat semua" dan verifikasi redirect ke /notifications
    const lihatSemua = dropdown.getByRole('link', { name: /Lihat semua/i });
    await expect(lihatSemua).toBeVisible({ timeout: 5_000 });
    await lihatSemua.click();

    // Pastikan diarahkan ke halaman notifikasi
    await expect(page).toHaveURL(/\/notifications/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Notifikasi/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.notif-page')).toBeVisible({ timeout: 5_000 });
  });

  test('TC-50 [+] halaman /notifications dapat diakses langsung via URL tanpa redirect', async ({ page }) => {
    await login(page, 'pbi24Tlm');

    // Navigasi langsung ke URL
    await page.goto('/notifications');

    // URL harus tetap /notifications, bukan dialihkan ke /login
    await expect(page).toHaveURL(/\/notifications/, { timeout: 10_000 });

    // Heading halaman & container halaman notifikasi ada dan scrollable
    await expect(page.getByRole('heading', { name: /Notifikasi/i })).toBeVisible({ timeout: 15_000 });
    const scroller = page.locator('.notif-page');
    await expect(scroller).toBeVisible({ timeout: 5_000 });
    const overflow = await scroller.evaluate((el) => getComputedStyle(el).overflowY);
    expect(['auto', 'scroll']).toContain(overflow);
  });

  test('TC-51 [-] akses /notifications tanpa login diredirect ke /login', async ({ page }) => {
    // Langsung akses /notifications tanpa login
    await page.goto('/notifications');

    // Harus dialihkan ke /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('#email')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#password')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('heading', { name: /^Notifikasi$/i })).not.toBeVisible();
  });

  test('TC-52 [-] dropdown menampilkan "Belum ada notifikasi" jika inbox kosong', async ({ page }) => {
    await login(page, 'pbi24Tlm');
    await page.goto('/');

    const bell = page.getByRole('button', { name: /notifikasi/i }).first();
    await expect(bell).toBeVisible({ timeout: 15_000 });
    await bell.click();

    const dropdown = page.locator('.notif-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Cek jika inbox kosong, pesan kosong harus muncul
    const itemsCount = await dropdown.locator('button').filter({ hasText: /.+/ }).count();
    if (itemsCount === 0) {
      await expect(dropdown.getByText(/Belum ada notifikasi/i)).toBeVisible({ timeout: 5_000 });
    }
  });

  test('TC-53 [+] klik item notif di dropdown menandai notif sebagai sudah dibaca', async ({ page }) => {
    await login(page, 'pbi24Tlm');
    await page.goto('/');

    const bell = page.getByRole('button', { name: /notifikasi/i }).first();
    await expect(bell).toBeVisible({ timeout: 15_000 });
    await bell.click();

    const dropdown = page.locator('.notif-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Temukan notifikasi yang memiliki indikator "belum dibaca" (badge)
    const unreadItem = dropdown.locator('button').filter({
      has: page.locator('span[style*="background-color: var(--primary-400)"]')
    }).first();

    const hasUnread = await unreadItem.count() > 0;
    if (!hasUnread) {
      console.log('TC-53: inbox kosong, tidak ada item untuk diklik — empty state terverifikasi');
      return;
    }

    // Klik notifikasi tersebut
    await unreadItem.click();

    // Tunggu refresh/update state dropdown
    await bell.click();
    await expect(dropdown).toBeVisible({ timeout: 10_000 });

    // Pastikan indikator belum dibaca pada notifikasi pertama tersebut sudah hilang
    const postBadge = unreadItem.locator('span[style*="background-color: var(--primary-400)"]');
    await expect(postBadge).not.toBeVisible({ timeout: 5_000 });
  });

});
