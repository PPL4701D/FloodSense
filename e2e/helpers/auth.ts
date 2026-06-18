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

export async function login(page: Page, role: Role): Promise<void> {
  const { email, password } = ACCOUNTS[role];
  
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto('/login', { timeout: 45000 });
      
      // Deteksi apakah diredirect karena sudah login, atau form login tampil
      try {
        await expect(page.locator('#email').or(page.getByRole('button', { name: /Keluar/i }))).toBeVisible({ timeout: 30_000 });
      } catch (e) {}

      // Jika tombol Keluar sudah ada, berarti sesi masih aktif (context terpakai ulang)
      if (await page.getByRole('button', { name: /Keluar/i }).isVisible()) {
        return;
      }

      await page.locator('#email').fill(email, { timeout: 30_000 });
      await page.locator('#password').fill(password, { timeout: 15_000 });
      await page.getByRole('button', { name: 'Masuk', exact: true }).click({ timeout: 15_000 });
      // Tunggu hingga tidak lagi di halaman login (redirect berhasil).
      await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
      // Pastikan sesi login selesai diproses client-side dengan mendeteksi tombol Keluar (logout) di header.
      await expect(page.getByRole('button', { name: /Keluar/i })).toBeVisible({ timeout: 30_000 });
      return;
    } catch (err) {
      if (attempt === 2) throw err;
      await page.waitForTimeout(2000);
    }
  }
}

/** Logout bila tombol/menu keluar tersedia (best-effort). */
export async function logout(page: Page): Promise<void> {
  await page.goto('/profile');
  const keluar = page.getByRole('button', { name: /Keluar/i });
  if (await keluar.count()) await keluar.first().click();
}
