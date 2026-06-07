import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-10 / FS-10 (Deteksi Spam & Duplikasi).
 * Rate-limit/dedup bersifat server-side saat submit (tidak diuji submit massal di E2E
 * agar tidak mengotori data). Yang diuji: surface moderasi flagged & cluster duplikat.
 */

test.describe('PBI-10 — Deteksi Spam & Duplikasi', () => {
  test('TC: antrian moderasi (filter Ditandai/flagged) tersedia di verifikasi staf', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/verification');
    await expect(page.getByRole('heading', { name: /Verifikasi/i }).first()).toBeVisible({ timeout: 15_000 });
    // Statistik "Ditandai" (flagged) tampil di strip stats.
    await expect(page.getByText(/Ditandai/i).first()).toBeVisible();
  });

  test('TC: halaman deteksi duplikat (clusters) dapat diakses staf', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/clusters');
    await expect(page).toHaveURL(/\/staff\/clusters/);
    await expect(page.getByText(/Duplikat|Cluster|Spam/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
