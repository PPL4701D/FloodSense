import { test, expect } from '@playwright/test';

/**
 * Sprint 2 — PBI-30 / FS-80 (PWA Installable).
 * Prompt install bersifat heuristik browser → diuji manifest + service worker + ikon.
 */

test.describe('PBI-30 — PWA Installable', () => {
  test('TC: manifest.json tersedia & valid', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest).toHaveProperty('name');
    expect(Array.isArray(manifest.icons)).toBeTruthy();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  test('TC: halaman me-link manifest + mendaftarkan service worker', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    // SW terdaftar (sw.js) — beri waktu registrasi.
    await page.waitForTimeout(2_000);
    const hasSW = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    expect(hasSW).toBeTruthy();
  });

  test('TC: ikon PWA 192 & 512 dapat diakses', async ({ request }) => {
    const res = await request.get('/manifest.json');
    const manifest = await res.json();
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes.join(' ')).toMatch(/192x192/);
    expect(sizes.join(' ')).toMatch(/512x512/);
  });
});
