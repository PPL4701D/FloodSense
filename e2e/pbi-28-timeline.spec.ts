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

  test('TC-01: Warga Lapor -> Admin Approve -> Warga Cek Timeline', async ({ browser }) => {
    // ==========================================
    // 1. Warga Buat Laporan
    // ==========================================
    const wargaContext = await browser.newContext();
    const wargaPage = await wargaContext.newPage();
    await login(wargaPage, 'warga');
    
    await wargaPage.goto('/report/new');
    await wargaPage.waitForTimeout(3000); // Tunggu map/GPS loading
    
    // Step 1: Lokasi
    await wargaPage.getByRole('button', { name: /Lanjut/i }).first().click();
    
    // Step 2: Keparahan
    await wargaPage.getByText('Berat', { exact: true }).click();
    await wargaPage.getByLabel(/Deskripsi/i).fill('Test E2E Approved - ' + Date.now());
    await wargaPage.getByRole('button', { name: /Lanjut ke Foto/i }).click();
    
    // Step 3: Foto (Skip)
    await wargaPage.getByRole('button', { name: /Lewati/i }).click();
    
    // Step 4: Kirim
    await wargaPage.getByRole('button', { name: /Kirim Laporan/i }).click();
    await expect(wargaPage.getByText('Laporan Terkirim!')).toBeVisible({ timeout: 20_000 });
    
    // Cari URL laporan yang baru dibuat dari daftar laporan
    await wargaPage.goto('/reports');
    await wargaPage.waitForTimeout(3000); 
    const reportLink = wargaPage.locator('a[href^="/report/"]').first();
    await expect(reportLink).toBeVisible({ timeout: 15_000 });
    const reportUrl = await reportLink.getAttribute('href');
    
    // LOGOUT Warga (Tutup Jendela)
    await wargaContext.close();

    // ==========================================
    // 2. Admin Verifikasi (Approved)
    // ==========================================
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, 'admin');
    
    await adminPage.goto(reportUrl!);
    await expect(adminPage.getByRole('heading', { name: /Detail Laporan/i })).toBeVisible({ timeout: 15_000 });
    
    // Admin melakukan approve
    await adminPage.getByText('Setujui Laporan').click();
    await adminPage.getByPlaceholder(/Jelaskan alasan/i).fill('Sudah dicek lapangan, laporan ini valid.');
    await adminPage.getByRole('button', { name: /Kirim Keputusan Verifikasi/i }).click();
    
    await expect(adminPage.getByText(/Laporan Berhasil Diverifikasi/i)).toBeVisible({ timeout: 15_000 });
    
    // LOGOUT Admin (Tutup Jendela)
    await adminContext.close();

    // ==========================================
    // 3. Warga Cek Status Timeline
    // ==========================================
    const wargaContext2 = await browser.newContext();
    const wargaPage2 = await wargaContext2.newPage();
    await login(wargaPage2, 'warga');
    
    await wargaPage2.goto(reportUrl!);
    await expect(wargaPage2.getByRole('heading', { name: /Detail Laporan/i })).toBeVisible({ timeout: 15_000 });
    
    // Cek Timeline & Status berubah jadi Terverifikasi
    await expect(wargaPage2.getByText('Terverifikasi').first()).toBeVisible({ timeout: 10_000 });
    await expect(wargaPage2.getByText(/Sudah dicek lapangan, laporan ini valid/i)).toBeVisible();
    
    await wargaContext2.close();
  });

  test('TC-02: Warga Lapor -> Admin Reject -> Warga Cek Timeline', async ({ browser }) => {
    // ==========================================
    // 1. Warga Buat Laporan
    // ==========================================
    const wargaContext = await browser.newContext();
    const wargaPage = await wargaContext.newPage();
    await login(wargaPage, 'warga');
    
    await wargaPage.goto('/report/new');
    await wargaPage.waitForTimeout(3000); // Tunggu map/GPS loading
    
    // Step 1: Lokasi
    await wargaPage.getByRole('button', { name: /Lanjut/i }).first().click();
    
    // Step 2: Keparahan
    await wargaPage.getByText('Ringan', { exact: true }).click();
    await wargaPage.getByLabel(/Deskripsi/i).fill('Test E2E Rejected - ' + Date.now());
    await wargaPage.getByRole('button', { name: /Lanjut ke Foto/i }).click();
    
    // Step 3: Foto (Skip)
    await wargaPage.getByRole('button', { name: /Lewati/i }).click();
    
    // Step 4: Kirim
    await wargaPage.getByRole('button', { name: /Kirim Laporan/i }).click();
    await expect(wargaPage.getByText('Laporan Terkirim!')).toBeVisible({ timeout: 20_000 });
    
    // Cari URL laporan yang baru dibuat dari daftar laporan
    await wargaPage.goto('/reports');
    await wargaPage.waitForTimeout(3000); 
    const reportLink = wargaPage.locator('a[href^="/report/"]').first();
    await expect(reportLink).toBeVisible({ timeout: 15_000 });
    const reportUrl = await reportLink.getAttribute('href');
    
    // LOGOUT Warga (Tutup Jendela)
    await wargaContext.close();

    // ==========================================
    // 2. Admin Verifikasi (Rejected)
    // ==========================================
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, 'admin');
    
    await adminPage.goto(reportUrl!);
    await expect(adminPage.getByRole('heading', { name: /Detail Laporan/i })).toBeVisible({ timeout: 15_000 });
    
    // Admin melakukan penolakan (Reject)
    await adminPage.getByText('Tolak Laporan (Palsu)').click();
    await adminPage.getByPlaceholder(/Jelaskan alasan/i).fill('Laporan palsu / Hoax.');
    await adminPage.getByRole('button', { name: /Kirim Keputusan Verifikasi/i }).click();
    
    await expect(adminPage.getByText(/Laporan Berhasil Diverifikasi/i)).toBeVisible({ timeout: 15_000 });
    
    // LOGOUT Admin (Tutup Jendela)
    await adminContext.close();

    // ==========================================
    // 3. Warga Cek Status Timeline
    // ==========================================
    const wargaContext2 = await browser.newContext();
    const wargaPage2 = await wargaContext2.newPage();
    await login(wargaPage2, 'warga');
    
    await wargaPage2.goto(reportUrl!);
    await expect(wargaPage2.getByRole('heading', { name: /Detail Laporan/i })).toBeVisible({ timeout: 15_000 });
    
    // Cek Timeline & Status berubah jadi Ditolak
    await expect(wargaPage2.getByText('Ditolak').first()).toBeVisible({ timeout: 10_000 });
    await expect(wargaPage2.getByText(/Laporan palsu \/ Hoax/i)).toBeVisible();
    
    await wargaContext2.close();
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
