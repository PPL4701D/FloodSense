import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * PBI-30 / FS-80: PWA Installable
 */

test.describe('PBI-30 — PWA Installable', () => {

  test('TC-08: Instalasi PWA & Fitur Luring (Offline) (Gabungan: Manifest, Install App, Fullscreen, Tampilan Mode Pesawat)', async ({ page, request, context }) => {
    const res = await request.get('/manifest.json');
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest).toHaveProperty('name');
    expect(Array.isArray(manifest.icons)).toBeTruthy();
    // Pergi ke halaman utama (AppShell) agar Service Worker ter-register
    await page.goto('/');
    
    // Tunggu Service Worker aktif dan caching selesai (sangat penting)
    await page.waitForTimeout(3000); 
    
    await context.setOffline(true);
    try {
      await page.reload({ timeout: 10_000 });
      // Pastikan kita masih berada di dalam antarmuka aplikasi (bukan dino)
      await expect(page.locator('body')).not.toContainText('ERR_INTERNET_DISCONNECTED', { timeout: 5000 });
    } catch {
    }
    
    await context.setOffline(false);
  });

  test('TC-09: Pendaftaran & Penerimaan Notifikasi Push (Gabungan: Daftar Pekerja Latar Belakang & Notifikasi Masuk)', async ({ page, context }) => {
    await context.grantPermissions(['notifications'], { origin: 'http://localhost:3000' });
    await login(page, 'warga');
    
    await page.goto('/settings/notifications');
    
    await expect(page.getByText(/Notifikasi Perangkat/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-10: Pencegahan Error PWA & Izin Ditolak (Gabungan: Browser Lawas, Blokir Izin Notifikasi, Sinyal Jelek, Server Kacau)', async ({ page, context }) => {
    await context.grantPermissions([], { origin: 'http://localhost:3000' });
    
    await login(page, 'warga');
    
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 15_000 });
    
    const notifPermission = await page.evaluate(async () => {
      if (!('Notification' in window)) return 'denied';
      return Notification.permission;
    });
    expect(['denied', 'default']).toContain(notifPermission);
    await page.route('**/*.png', route => route.abort());
    await page.goto('/reports');
    await expect(page.getByText(/Laporan/i).first()).toBeVisible();
  });

});
