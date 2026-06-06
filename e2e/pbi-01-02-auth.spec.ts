import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 1 — PBI-1 (Registrasi & Login Email/OAuth), PBI-2 (Login/Logout/Reset).
 * dibuat oleh: Adnan Rizki
 */

test.describe('PBI-1/2 — Autentikasi', () => {
  test('halaman login tampil dengan form email & password', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();
  });

  test('login dengan kredensial salah menampilkan pesan error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('warga@fs.id');
    await page.locator('#password').fill('passwordSALAH');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await expect(page.getByText(/Email atau password salah|Invalid/i)).toBeVisible();
  });

  test('login warga berhasil dan keluar dari halaman login', async ({ page }) => {
    await login(page, 'warga');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('halaman registrasi dapat diakses', async ({ page }) => {
    await page.goto('/register');
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('#email')).toBeVisible();
  });

  test('halaman reset password dapat diakses', async ({ page }) => {
    await page.goto('/reset-password');
    await expect(page).toHaveURL(/\/reset-password/);
    await expect(page.locator('#email')).toBeVisible();
  });

  test('logout mengembalikan ke kondisi tidak login', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/profile');
    const keluar = page.locator('button.btn-danger', { hasText: 'Keluar' });
    await expect(keluar).toBeVisible();
    await keluar.click();
    await page.goto('/profile');
    await expect(page.getByRole('link', { name: /Masuk/i }).or(page.getByText(/Masuk untuk/i))).toBeVisible();
  });
});
