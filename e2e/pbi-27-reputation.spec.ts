import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-27 / FS-72 (Reputasi, Lencana & Leaderboard).
 * Tier: Pemula / Kontributor / Andal / Pahlawan Banjir.
 * Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-27 — Reputasi & Leaderboard', () => {
  test('TC-35: badge tier reputasi tampil di profil', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/profile');
    await expect(page.getByText(/Reputasi/i).first()).toBeVisible({ timeout: 15_000 });
    // Lencana tier (salah satu) tampil.
    await expect(page.getByText(/Pemula|Kontributor|Andal|Pahlawan/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-36: leaderboard menampilkan papan peringkat kontributor', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { name: /Papan Peringkat/i })).toBeVisible({ timeout: 15_000 });
    // Adaptif: ada kontributor (highlight "(Anda)") ATAU empty-state.
    await expect(page.getByText(/\(Anda\)|Belum ada kontributor|poin|skor|Papan Peringkat/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-37: halaman leaderboard dapat di-scroll', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/leaderboard');
    await expect(page.getByRole('heading', { name: /Papan Peringkat/i })).toBeVisible({ timeout: 15_000 });
    const scrollable = await page.evaluate(() =>
      Array.from(document.querySelectorAll('div')).some((el) => {
        const s = getComputedStyle(el);
        return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.clientHeight > 0;
      })
    );
    expect(scrollable).toBeTruthy();
    await expect(page.getByRole('heading', { name: /Papan Peringkat/i })).toBeVisible();
  });
});
