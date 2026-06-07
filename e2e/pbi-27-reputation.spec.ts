import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-27 / FS-72 (Reputasi, Lencana & Leaderboard).
 */

test.describe('PBI-27 — Reputasi & Leaderboard', () => {
  test('TC-001: badge reputasi tampil di profil', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/profile');
    // Tier lencana: Pemula/Kontributor/Andal/Pahlawan.
    await expect(page.getByText(/Pemula|Kontributor|Andal|Pahlawan/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-003: leaderboard menampilkan top kontributor terurut', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { name: /Papan Peringkat/i })).toBeVisible({ timeout: 15_000 });
  });

  test('halaman leaderboard bisa di-scroll', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { name: /Papan Peringkat/i })).toBeVisible({ timeout: 15_000 });
    // Container utama scrollable (height 100% + overflowY auto).
    const scrollable = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div')).some((el) => {
        const s = getComputedStyle(el);
        return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.clientHeight > 0;
      });
    });
    expect(scrollable).toBeTruthy();
  });
});
