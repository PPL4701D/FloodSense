import { test, expect, APIRequestContext } from '@playwright/test';
import { login } from './helpers/auth';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 2 — PBI-36 / FS-86 (Toast Notifikasi In-App Realtime).
 *
 * Fokus uji = KOMPONEN TOAST (tampil realtime, tutup via X, filter per-user, batas 3).
 * Notifikasi disisipkan via "pintu belakang" (REST + service-role) = SIMULASI event
 * "notifikasi masuk" (di prod lahir dari broadcast/komentar/verifikasi — diuji di PBI lain).
 *
 * 1 positive + 2 negative/exception. Tabel notifications realtime-enabled di DB testing.
 */

function env(): { url: string; service: string } {
  const txt = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
  const get = (k: string) => (txt.match(new RegExp(`^${k}=(.*)`, 'm'))?.[1] ?? '').trim();
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), service: get('SUPABASE_SERVICE_ROLE_KEY') };
}

async function uidOf(request: APIRequestContext, url: string, service: string, email: string): Promise<string | undefined> {
  const res = await request.get(`${url}/auth/v1/admin/users?per_page=300`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  });
  return (await res.json())?.users?.find((u: { email?: string; id: string }) => u.email === email)?.id;
}

function notif(userId: string, title: string) {
  return { user_id: userId, type: 'broadcast', title, body: 'Notifikasi uji toast.', is_read: false };
}

test.describe('PBI-36 — Toast Notifikasi In-App Realtime', () => {

  // ============================ POSITIVE ============================

  test('P1 (TC-54): notifikasi baru → toast muncul realtime & dapat ditutup via X', async ({ page, request }) => {
    const { url, service } = env();
    test.skip(!url || !service, 'Kredensial Supabase tidak tersedia di .env.local');

    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    const uid = await uidOf(request, url, service, 'warga@fs.id');
    test.skip(!uid, 'User id warga tidak ditemukan');
    await page.waitForTimeout(2500); // beri waktu channel realtime subscribe

    // Pintu belakang: sisipkan 1 notifikasi untuk WARGA.
    const title = `Uji Toast E2E ${Date.now()}`;
    const res = await request.post(`${url}/rest/v1/notifications`, {
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data: notif(uid!, title),
    });
    expect(res.ok()).toBeTruthy();

    // Toast muncul via realtime.
    await expect(page.getByText(title)).toBeVisible({ timeout: 15_000 });
    // Tutup via tombol X → toast hilang.
    await page.locator('.notif-toast').filter({ hasText: title }).getByRole('button', { name: /Tutup/i }).click();
    await expect(page.getByText(title)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  // ===================== NEGATIVE / EXCEPTION =====================

  test('N1 (TC-61): isolasi — notifikasi milik user LAIN tidak memunculkan toast pada warga', async ({ page, request }) => {
    const { url, service } = env();
    test.skip(!url || !service, 'Kredensial Supabase tidak tersedia di .env.local');

    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    const adminId = await uidOf(request, url, service, 'admin@fs.id');
    test.skip(!adminId, 'User id admin tidak ditemukan');
    await page.waitForTimeout(2500);

    // Pintu belakang: sisipkan notifikasi untuk ADMIN (bukan warga).
    const title = `Notif Admin ${Date.now()}`;
    const res = await request.post(`${url}/rest/v1/notifications`, {
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data: notif(adminId!, title),
    });
    expect(res.ok()).toBeTruthy();

    // Tunggu cukup lama; pastikan toast TIDAK muncul (notifikasi bukan milik warga).
    await page.waitForTimeout(4000);
    await expect(page.locator('.notif-toast')).toHaveCount(0);
    await expect(page.getByText(title)).toHaveCount(0);
    // Bukti akhir terlihat: beranda normal.
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('N2 (TC-62): anti-overflow — 4 notifikasi sekaligus → maksimal 3 toast tampil', async ({ page, request }) => {
    const { url, service } = env();
    test.skip(!url || !service, 'Kredensial Supabase tidak tersedia di .env.local');

    await login(page, 'warga');
    await page.goto('/');
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    const uid = await uidOf(request, url, service, 'warga@fs.id');
    test.skip(!uid, 'User id warga tidak ditemukan');
    await page.waitForTimeout(2500);

    // Pintu belakang: sisipkan 4 notifikasi sekaligus untuk warga.
    const stamp = Date.now();
    const rows = [1, 2, 3, 4].map((n) => notif(uid!, `Banjir Notif #${n} ${stamp}`));
    const res = await request.post(`${url}/rest/v1/notifications`, {
      headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      data: rows,
    });
    expect(res.ok()).toBeTruthy();

    // Walau 4 masuk, toast yang tampil dibatasi maksimal 3 (tertua di-drop).
    await expect(page.locator('.notif-toast')).toHaveCount(3, { timeout: 12_000 });
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});
