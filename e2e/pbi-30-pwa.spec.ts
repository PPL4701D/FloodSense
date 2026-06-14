import { test, expect } from '@playwright/test';

/**
 * Sprint 2 — PBI-30 / FS-80 (PWA Installable).
 * Prompt install heuristik browser → diuji manifest + service worker + ikon.
 * Tiap test ditutup pada halaman terbuka dengan teks terlihat (untuk demo --ui).
 */

test.describe('PBI-30 — PWA Installable', () => {
  test('TC-44: manifest.json tersedia & valid (name + icons)', async ({ page, request }) => {
    const res = await request.get('/manifest.json');
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest).toHaveProperty('name');
    expect(Array.isArray(manifest.icons)).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThan(0);

    // Bukti akhir terlihat: buka aplikasi (halaman login memuat teks).
    await page.goto('/login');
    await expect(page.getByText(/Masuk ke platform pemantauan banjir Indonesia/i)).toBeVisible({ timeout: 15_000 });
  });

  test('TC-45: halaman me-link manifest + mendaftarkan service worker', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    await page.waitForTimeout(2_000);
    const hasSW = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    expect(hasSW).toBeTruthy();

    // Bukti akhir terlihat.
    await page.goto('/login');
    await expect(page.getByText(/Masuk ke platform pemantauan banjir Indonesia/i)).toBeVisible({ timeout: 15_000 });
  });

  test('TC-46: ikon PWA 192 & 512 tersedia', async ({ page, request }) => {
    const res = await request.get('/manifest.json');
    const manifest = await res.json();
    const sizes = (manifest.icons as { sizes: string }[]).map((i) => i.sizes).join(' ');
    expect(sizes).toMatch(/192x192/);
    expect(sizes).toMatch(/512x512/);

    await page.goto('/login');
    await expect(page.getByText(/Masuk ke platform pemantauan banjir Indonesia/i)).toBeVisible({ timeout: 15_000 });
  });
});
