import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 2 — PBI-36 / FS-86 (Toast Notifikasi In-App Realtime).
 * Uji efek nyata: insert 1 notifikasi (service role) → toast muncul via realtime →
 * tutup via tombol X. Membaca URL + service key dari .env.local (self-contained).
 */

function env(): { url: string; service: string } {
  const txt = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  const get = (k: string) => (txt.match(new RegExp(`^${k}=(.*)`, 'm'))?.[1] ?? '').trim();
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), service: get('SUPABASE_SERVICE_ROLE_KEY') };
}

test.describe('PBI-36 — Toast Notifikasi In-App Realtime', () => {
  test('TC-54: notifikasi baru memunculkan toast realtime & dapat ditutup via X', async ({ page, request }) => {
    const { url, service } = env();
    test.skip(!url || !service, 'Kredensial Supabase tidak tersedia di .env.local');

    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });

    // Ambil user-id warga via Admin API (deterministik; sesi app pakai cookie, bukan localStorage).
    const ures = await request.get(`${url}/auth/v1/admin/users?per_page=200`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
    const uid: string | undefined = (await ures.json())?.users
      ?.find((u: { email?: string; id: string }) => u.email === 'warga@fs.id')?.id;
    test.skip(!uid, 'User id warga tidak ditemukan');

    // Pastikan channel realtime sempat subscribe sebelum insert.
    await page.waitForTimeout(2500);

    const title = `Uji Toast E2E ${Date.now()}`;
    const res = await request.post(`${url}/rest/v1/notifications`, {
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data: { user_id: uid, type: 'broadcast', title, body: 'Notifikasi uji toast realtime.', is_read: false },
    });
    expect(res.ok()).toBeTruthy();

    // Toast muncul via realtime (judul unik terlihat).
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });

    // Tutup toast via tombol X (tanpa navigasi) → toast hilang.
    const toast = page.locator('.notif-toast').filter({ hasText: title });
    await toast.getByRole('button', { name: /Tutup/i }).click();
    await expect(page.getByText(title)).toHaveCount(0);

    // Bukti akhir terlihat: tetap di beranda (tab "Peta").
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});
