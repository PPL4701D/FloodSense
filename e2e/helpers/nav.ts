import { Page, expect } from '@playwright/test';

/**
 * Buka halaman detail laporan pertama dari /reports.
 * Mengembalikan true bila berhasil membuka detail, false bila tak ada laporan.
 */
export async function openFirstReport(page: Page): Promise<boolean> {
  await page.goto('/reports');
  const link = page.locator('a[href^="/report/"]').first();
  // Daftar laporan dimuat async — tunggu link muncul dulu.
  try {
    await link.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    return false;
  }
  await link.click();
  await expect(page).toHaveURL(/\/report\//, { timeout: 15_000 });
  return true;
}
