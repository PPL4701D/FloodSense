import { Page, expect } from '@playwright/test';

/**
 * Helper autentikasi E2E — login via UI memakai akun uji.
 * Role tersedia: admin / tlm / staf / warga (password sama: 123456).
 */

export const ACCOUNTS = {
  admin: { email: 'admin@fs.id', password: '123456' },
  tlm: { email: 'tlm@fs.id', password: '123456' },
  staf: { email: 'staf@fs.id', password: '123456' },
  warga: { email: 'warga@fs.id', password: '123456' },
} as const;

export type Role = keyof typeof ACCOUNTS;

/** Login via halaman /login, lalu tunggu redirect keluar dari /login. */
export async function login(page: Page, role: Role): Promise<void> {
  const { email, password } = ACCOUNTS[role];
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  // Tunggu hingga tidak lagi di halaman login (redirect berhasil).
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** Logout bila tombol/menu keluar tersedia (best-effort). */
export async function logout(page: Page): Promise<void> {
  await page.goto('/profile');
  const keluar = page.getByRole('button', { name: /Keluar/i });
  if (await keluar.count()) await keluar.first().click();
}
