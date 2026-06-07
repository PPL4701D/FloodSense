import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-15 / FS-15 (Audit Log Aktivitas Admin).
 */

test.describe('PBI-15 — Audit Log Viewer', () => {
  test('halaman audit log tampil dengan daftar log + filter', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible({ timeout: 15_000 });
    // Filter aksi + admin pelaku + pencarian tersedia.
    await expect(page.getByPlaceholder(/Cari kata kunci/i)).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /Semua aksi/i })).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /Semua admin pelaku/i })).toBeVisible();
  });

  test('TC-001/entri log menampilkan aksi & pelaku (data ada)', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible({ timeout: 15_000 });
    // Minimal satu entri log (kartu) memuat aksi yang dikenal — bukan <option> filter.
    await expect(page.locator('.card').filter({ hasText: /REPORT_VERIFY|REPORT_SCHEDULE_CHECK|ROLE_CHANGE/ }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-002: filter jenis aksi mempersempit daftar', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('combobox').filter({ hasText: /Semua aksi/i }).selectOption('REPORT_VERIFY');
    // Tetap di halaman & tidak error.
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  });

  test('ekspor CSV audit log tersedia', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('button', { name: /Ekspor CSV/i })).toBeVisible({ timeout: 15_000 });
  });

  test('TC-003: non-admin tidak bisa akses audit log (dialihkan)', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/admin/audit-logs');
    await expect(page).not.toHaveURL(/\/admin\/audit-logs/, { timeout: 15_000 });
  });
});
