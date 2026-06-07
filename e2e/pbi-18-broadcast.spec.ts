import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-18 / FS-18 (Broadcast Pesan TLM).
 * Catatan: pengiriman push aktual tidak di-assert (butuh subscriber nyata).
 */

test.describe('PBI-18 — Broadcast TLM', () => {
  test('TC: form broadcast (wilayah search, severity, pesan) tampil untuk TLM', async ({ page }) => {
    await login(page, 'tlm');
    await page.goto('/broadcast');
    await expect(page.getByRole('heading', { name: /Broadcast Peringatan/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder(/Cari provinsi \/ kabupaten \/ kecamatan/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Kirim Broadcast/i })).toBeVisible();
  });

  test('TC: pencarian wilayah target menampilkan hasil', async ({ page }) => {
    await login(page, 'tlm');
    await page.goto('/broadcast');
    await page.getByPlaceholder(/Cari provinsi \/ kabupaten \/ kecamatan/i).fill('Bandung');
    await expect(page.getByText(/Bandung/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('warga tidak bisa mengakses /broadcast (dialihkan)', async ({ page }) => {
    await login(page, 'warga');
    await page.goto('/broadcast');
    await expect(page).not.toHaveURL(/\/broadcast/, { timeout: 15_000 });
  });
});
