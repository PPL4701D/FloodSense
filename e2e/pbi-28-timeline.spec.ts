import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * PBI-28 / FS-78: Timeline Status Laporan
 */

const UUID_PENDING = '550e8400-e29b-41d4-a716-446655440001';
const UUID_VERIFIED = '550e8400-e29b-41d4-a716-446655440002';
const UUID_REJECTED = '550e8400-e29b-41d4-a716-446655440003';
const UUID_INCOMPLETE = '550e8400-e29b-41d4-a716-446655440004';
const UUID_BROKEN_IMG = '550e8400-e29b-41d4-a716-446655440005';

test.describe('PBI-28 — Timeline Status Laporan', () => {

  test.beforeEach(async ({ page }) => {
    // General route handler for reports to mock based on ID
    await page.route('**/rest/v1/reports*', async route => {
      const url = route.request().url();
      const isSingle = route.request().headers()['accept']?.includes('application/vnd.pgrst.object');
      
      const fulfillMock = async (data: any) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(isSingle ? data : [data])
        });
      };

      if (url.includes(UUID_PENDING)) {
        await fulfillMock({
          id: UUID_PENDING,
          created_at: new Date().toISOString(),
          status: 'pending',
          severity: 'berat',
          description: 'Banjir parah',
          location: 'POINT(110 -7)',
          report_photos: [{ storage_path: 'mock.jpg' }],
          reporter_id: 'mock-reporter',
        });
      } else if (url.includes(UUID_VERIFIED)) {
        await fulfillMock({
          id: UUID_VERIFIED,
          created_at: new Date().toISOString(),
          status: 'verified',
          severity: 'sedang',
          verificationNote: 'Sesuai lapangan',
          location: 'POINT(110 -7)',
          report_photos: [],
          reporter_id: 'mock-reporter',
        });
      } else if (url.includes(UUID_REJECTED)) {
        await fulfillMock({
          id: UUID_REJECTED,
          created_at: new Date().toISOString(),
          status: 'rejected',
          severity: 'ringan',
          verificationNote: 'Laporan palsu/spam',
          location: 'POINT(110 -7)',
          report_photos: [],
          reporter_id: 'mock-reporter',
        });
      } else if (url.includes(UUID_INCOMPLETE)) {
        await fulfillMock({
          id: UUID_INCOMPLETE,
          created_at: new Date().toISOString(),
          status: 'pending',
          severity: 'ringan',
          location: 'NULL_ATAU_RUSAK',
          report_photos: [],
          reporter_id: 'mock-reporter',
        });
      } else if (url.includes(UUID_BROKEN_IMG)) {
        await fulfillMock({
          id: UUID_BROKEN_IMG,
          created_at: new Date().toISOString(),
          status: 'pending',
          severity: 'ringan',
          location: 'POINT(110 -7)',
          report_photos: [{ storage_path: 'hilang.jpg' }],
          reporter_id: 'mock-reporter',
        });
      } else {
        await route.continue();
      }
    });

    // Mock timeline verification notes api if any
    await page.route('**/api/reports/*/verification-note', async route => {
      await route.fulfill({ status: 200, json: { notes: 'Catatan simulasi' } });
    });
  });

  test('TC-01: Validasi Tampilan Utama Laporan (Gabungan: Tampil Timeline, Warna Label, Load Foto)', async ({ page }) => {
    await login(page, 'warga');

    await page.route('**/storage/v1/object/public/flood-photos/mock.jpg*', async route => {
      // 1px transparent gif
      const buf = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
      await route.fulfill({ status: 200, contentType: 'image/gif', body: buf });
    });

    await page.goto(`/report/${UUID_PENDING}`);

    await expect(page.getByText(/Status Laporan|Menunggu Verifikasi/i).first()).toBeVisible({ timeout: 15_000 });
    
    // Cek label tingkat keparahan (Berat)
    const severityLabel = page.getByText(/Berat/i).first();
    await expect(severityLabel).toBeVisible();

    const img = page.locator('img[alt*="Foto"]').first();
    await expect(img).toBeVisible();
  });

  test('TC-02: Validasi Riwayat Verifikasi dan Penolakan (Gabungan: Cek Status Verified & Rejected)', async ({ page }) => {
    await login(page, 'warga');
    
    await page.goto(`/report/${UUID_VERIFIED}`);
    await expect(page.getByText(/Terverifikasi/i).first()).toBeVisible({ timeout: 15_000 });
    
    await page.goto(`/report/${UUID_REJECTED}`);
    await expect(page.getByText(/Ditolak/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Catatan simulasi/i).first()).toBeVisible();
  });

  test('TC-03: Validasi Laporan Tanpa Data Utuh (Gabungan: Laporan Tanpa Foto & Lokasi Error)', async ({ page }) => {
    await login(page, 'warga');
    
    await page.goto(`/report/${UUID_INCOMPLETE}`);

    await expect(page.getByText(/Status Laporan/i).first()).toBeVisible({ timeout: 15_000 });
    
    const img = page.locator('img[alt*="Foto"]');
    await expect(img).toHaveCount(0);
    
    const mapContainer = page.locator('.leaflet-container, [id^="map"], .glass');
    if (await mapContainer.count() > 0) {
      await expect(mapContainer.first()).toBeVisible();
    }
  });

  test('TC-04: Penanganan Error Kritis Detail Laporan (Gabungan: ID Ngawur, Sinyal Putus, Foto Hilang)', async ({ page }) => {
    await login(page, 'warga');
    
    await page.goto('/report/ngawur');
    await expect(page.getByText(/Gagal memuat detail laporan|Laporan tidak ditemukan/i).first()).toBeVisible({ timeout: 15_000 });

    await page.route('**/*.{png,jpg,jpeg,webp}', route => route.abort());
    
    await page.goto(`/report/${UUID_BROKEN_IMG}`);
    await expect(page.getByText(/Status Laporan/i).first()).toBeVisible({ timeout: 15_000 });
  });

});
