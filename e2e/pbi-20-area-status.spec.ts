import { test, expect } from '@playwright/test';

/**
 * Sprint 1 — PBI-20 (Status Area Banjir Otomatis — legenda status area di peta).
 * dibuat oleh: Andrarieza Rizqi Pradana
 */

test.describe('PBI-20 — Status Area Banjir', () => {
  test('legenda peta menampilkan kategori Status Area', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    // Buka legenda lewat tombol info "Level Banjir".
    await page.getByRole('button', { name: /Level Banjir/i }).click();
    await expect(page.getByText('Status Area')).toBeVisible();
  });
});
