import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-16 / FS-16 (Push Notification PWA).
 * Pengujian lengkap alur Push Notification (Opt-in, Permission Denied, Opt-out, No Support)
 * menggunakan akun dedicated: valerina.warga@fs.id
 */

test.describe('PBI-16 — Push Notification', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mocking API Notifikasi dan Service Worker secara default di setiap test case
    await page.addInitScript(() => {
      // Mock class Notification
      const mockNotification = function (title: string, options?: any) {};
      (mockNotification as any).permission = 'default';
      (mockNotification as any).requestPermission = async () => {
        return (window as any).mockNotificationPermission || 'granted';
      };
      (window as any).Notification = mockNotification;

      // Mock Subscription object
      const mockSubscription = {
        endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/mock-valerina-endpoint-id',
        keys: {
          p256dh: 'BIPUL15DL_mock_p256dh_key_for_testing_purposes',
          auth: 'mock_auth_key_12345'
        },
        toJSON() {
          return {
            endpoint: this.endpoint,
            keys: this.keys
          };
        },
        unsubscribe: async () => {
          (window as any).mockSubscriptionActive = false;
          return true;
        }
      };

      (window as any).mockSubscriptionActive = false;

      const mockPushManager = {
        getSubscription: async () => {
          return (window as any).mockSubscriptionActive ? mockSubscription : null;
        },
        subscribe: async () => {
          (window as any).mockSubscriptionActive = true;
          return mockSubscription;
        }
      };

      const mockRegistration = {
        pushManager: mockPushManager,
        showNotification: async () => {}
      };

      // Mock Service Worker
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          register: async () => mockRegistration,
          getRegistration: async () => mockRegistration,
          ready: Promise.resolve(mockRegistration),
          addEventListener: () => {},
          removeEventListener: () => {},
        },
        configurable: true,
      });

      // Mock PushManager class in window
      (window as any).PushManager = {};
    });
  });

  test('TC-16: Pendaftaran Langganan Notifikasi Perangkat (Opt-In - Positive Case)', async ({ page }) => {
    await login(page, 'valerina_warga');
    await page.goto('/settings/notifications');

    // Pastikan bagian push perangkat tampil
    await expect(page.getByText(/Notifikasi Perangkat \(Push\)/i)).toBeVisible({ timeout: 15_000 });
    
    // Verifikasi teks deskripsi awal
    await expect(page.getByText(/Dapatkan peringatan banjir walau aplikasi tertutup/i)).toBeVisible();

    // Verifikasi tombol awal adalah "Aktifkan"
    const toggleBtn = page.getByRole('button', { name: /Aktifkan/i }).first();
    await expect(toggleBtn).toBeVisible();

    // Klik tombol untuk mengaktifkan notifikasi
    await toggleBtn.click();

    // Verifikasi perubahan status menjadi Aktif
    await expect(page.getByText(/Aktif — Anda akan menerima peringatan banjir di perangkat ini/i)).toBeVisible({ timeout: 10_000 });
    
    // Tombol sekarang bertuliskan "Matikan"
    await expect(page.getByRole('button', { name: /Matikan/i }).first()).toBeVisible();
  });

  test('TC-16-Negative: Penolakan Izin Notifikasi Browser (Permission Denied - Negative Case)', async ({ page }) => {
    // Ubah mock agar menolak izin notifikasi
    await page.addInitScript(() => {
      (window as any).mockNotificationPermission = 'denied';
    });

    await login(page, 'valerina_warga');
    await page.goto('/settings/notifications');

    // Pastikan bagian push perangkat tampil
    await expect(page.getByText(/Notifikasi Perangkat \(Push\)/i)).toBeVisible({ timeout: 15_000 });

    // Verifikasi tombol "Aktifkan" tampil
    const toggleBtn = page.getByRole('button', { name: /Aktifkan/i }).first();
    await expect(toggleBtn).toBeVisible();

    // Klik tombol "Aktifkan"
    await toggleBtn.click();

    // Verifikasi munculnya pesan error "Izin notifikasi ditolak."
    await expect(page.getByText(/Izin notifikasi ditolak/i)).toBeVisible({ timeout: 10_000 });

    // Status harus tetap non-aktif (deskripsi awal masih ada dan tombol tetap "Aktifkan")
    await expect(page.getByText(/Dapatkan peringatan banjir walau aplikasi tertutup/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Aktifkan/i }).first()).toBeVisible();
  });

  test('TC-16-Exception-OptOut: Membatalkan Langganan Notifikasi Perangkat (Opt-Out - Exception Case)', async ({ page }) => {
    // Set status awal agar sudah berlangganan
    await page.addInitScript(() => {
      (window as any).mockSubscriptionActive = true;
    });

    await login(page, 'valerina_warga');
    await page.goto('/settings/notifications');

    // Verifikasi status awal sudah aktif
    await expect(page.getByText(/Aktif — Anda akan menerima peringatan banjir di perangkat ini/i)).toBeVisible({ timeout: 15_000 });
    
    const toggleBtn = page.getByRole('button', { name: /Matikan/i }).first();
    await expect(toggleBtn).toBeVisible();

    // Klik tombol "Matikan" untuk membatalkan langganan
    await toggleBtn.click();

    // Verifikasi status kembali menjadi non-aktif
    await expect(page.getByText(/Dapatkan peringatan banjir walau aplikasi tertutup/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Aktifkan/i }).first()).toBeVisible();
  });

  test('TC-16-Exception-NoSupport: Lingkungan Browser Tidak Mendukung Push Notification (Exception Case)', async ({ page }) => {
    // Hapus PushManager dari objek window (mensimulasikan browser tanpa dukungan Push API)
    // Tetap biarkan serviceWorker agar tidak menyebabkan crash pada modul PWA lain
    await page.addInitScript(() => {
      delete (window as any).PushManager;
    });

    await login(page, 'valerina_warga');
    await page.goto('/settings/notifications');

    // Verifikasi munculnya pesan bahwa browser tidak mendukung push notification
    await expect(page.getByText(/Perangkat\/browser ini tidak mendukung push notification/i)).toBeVisible({ timeout: 15_000 });

    // Tombol "Aktifkan" / "Matikan" tidak boleh tampil
    await expect(page.getByRole('button', { name: /Aktifkan|Matikan/i })).not.toBeVisible();
  });
});
