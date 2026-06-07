import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { openFirstReport } from './helpers/nav';

/**
 * Sprint 2 — PBI-31 / FS-81 (Bagikan Laporan + OG Image).
 * Native Web Share sheet tak dapat di-assert headless → uji tombol & OG image route.
 */

test.describe('PBI-31 — Bagikan Laporan', () => {
  test('TC: tombol Bagikan tampil di detail laporan', async ({ page }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');
    await expect(page.getByRole('button', { name: /Bagikan|Share/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC: OG image route laporan mengembalikan gambar', async ({ page, request }) => {
    await login(page, 'warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');
    const url = page.url();
    const id = url.split('/report/')[1]?.split(/[/?#]/)[0];
    test.skip(!id, 'ID laporan tidak terbaca');
    const res = await request.get(`/report/${id}/opengraph-image`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');
  });
});
