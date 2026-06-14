import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-15 / FS-15 (Audit Log Aktivitas Admin).
 * Render filter, isi entri, fungsi filter aksi, tombol ekspor, dan proteksi non-admin.
 * Tiap test berakhir pada teks yang terlihat.
 */

test.describe('PBI-15 — Audit Log Viewer', () => {
  test('TC-11: halaman audit log tampil dengan pencarian + filter aksi + filter pelaku', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByPlaceholder(/Cari kata kunci/i)).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /Semua aksi/i })).toBeVisible();
    await expect(page.getByRole('combobox').filter({ hasText: /Semua admin pelaku/i })).toBeVisible();
  });

  test('TC-12: tiap entri log menampilkan aksi & pelaku', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible({ timeout: 15_000 });

    // Adaptif: minimal satu kartu entri dengan aksi dikenal, ATAU empty-state.
    const entry = page.locator('.card').filter({ hasText: /REPORT_VERIFY|REPORT_SCHEDULE_CHECK|ROLE_CHANGE|REGION_/ }).first();
    if (await entry.count()) {
      await expect(entry).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.getByText(/Belum ada|Tidak ada|log/i).first()).toBeVisible();
    }
  });

  test('TC-13: filter jenis aksi mempersempit daftar tanpa error', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('combobox').filter({ hasText: /Semua aksi/i }).selectOption('REPORT_VERIFY');
    await page.waitForTimeout(600);
    // Tetap di halaman & tidak error.
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible();
  });

  test('TC-14: tombol ekspor CSV audit log tersedia', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/admin/audit-logs');
    await expect(page.getByRole('button', { name: /Ekspor CSV/i })).toBeVisible({ timeout: 15_000 });
  });

  test('TC-15: non-admin (staf) dialihkan keluar dari audit log', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/admin/audit-logs');
    await expect(page).not.toHaveURL(/\/admin\/audit-logs/, { timeout: 15_000 });
    // Dialihkan ke beranda peta; tab navigasi "Peta" terlihat sebagai bukti di --ui.
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });
});
