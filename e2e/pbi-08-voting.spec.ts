import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 1 — PBI-8 (Upvote/Downvote + Skor Kredibilitas).
 * dibuat oleh: Valerina
 */

test.describe('PBI-8 — Voting & Kredibilitas', () => {
  test('tombol vote (Valid/Tidak valid) tersedia di detail laporan', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/reports');
    const firstReport = page.locator('a[href^="/report/"]').first();
    await expect(firstReport).toBeVisible({ timeout: 20_000 });
    await firstReport.click();
    await expect(page).toHaveURL(/\/report\/[0-9a-f-]+/);
    await expect(page.locator('button[title="Valid"]').first()).toBeVisible();
    await expect(page.locator('button[title="Tidak valid"]').first()).toBeVisible();
  });
});
