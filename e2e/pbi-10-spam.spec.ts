import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

const FLAGGED_DUPLICATE_DESCRIPTION = 'Laporan kedua dari Titik B (dekat Titik A).';
const REJECTED_FLAGGED_DESCRIPTION = 'TC-09 laporan flagged untuk ditolak staf.';
let flaggedDuplicateReportId: string | null = null;
let reportsCreatedInPbi10Flow = 0;

/**
 * Sprint 2 — PBI-10 / FS-10 (Deteksi Spam & Duplikasi).
 * Rate-limit/dedup server-side saat submit; di E2E diuji surface moderasi (antrian
 * flagged) + halaman cluster duplikat seperti yang dilihat staf.
 * Tiap test diakhiri teks yang terlihat di halaman (untuk demo mode --ui).
 */

test.describe('PBI-10 — Deteksi Spam & Duplikasi', () => {
  test('TC-01: antrian moderasi (Ditandai/flagged) tampil & dapat difilter staf', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/verification');
    await expect(page.getByRole('heading', { name: /Verifikasi Laporan/i }).first()).toBeVisible({ timeout: 15_000 });

    // Strip statistik moderasi memuat kategori "Ditandai" (flagged).
    await expect(page.getByText(/Ditandai/i).first()).toBeVisible({ timeout: 15_000 });

    // Alur staf nyata: ketik di pencarian antrian, halaman tetap berfungsi.
    const search = page.getByPlaceholder(/Cari deskripsi, alamat, atau pelapor/i);
    await expect(search).toBeVisible();
    await search.fill('banjir');
    await page.waitForTimeout(600);

    await expect(page.getByRole('heading', { name: /Verifikasi Laporan/i }).first()).toBeVisible();
  });

  test('TC-02: halaman deteksi duplikat (clusters) dapat diakses & menampilkan hasil/empty', async ({ page }) => {
    await login(page, 'staf');
    await page.goto('/staff/clusters');
    await expect(page).toHaveURL(/\/staff\/clusters/);
    await expect(page.getByRole('heading', { name: /Deteksi Duplikat & Spam/i })).toBeVisible({ timeout: 15_000 });

    // Adaptif: ada daftar potensi duplikat ATAU empty-state ramah.
    await expect(
      page.getByText(/Tidak ada potensi duplikat terdeteksi|laporan|cluster|duplikat/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('TC-03: sistem menerima laporan normal (bukan spam/duplikat)', async ({ page, context }) => {
    // Naikkan timeout karena alur ini panjang: login + wizard 4 langkah + submit + spam-detection
    test.setTimeout(90_000);

    // 0. Mock reverse geocoding agar instan dan tidak menyebabkan re-render mendadak
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ display_name: 'Jl. Mock, Jakarta', address: { road: 'Jl. Mock', city: 'Jakarta' } }),
      });
    });

    // 1. Mock lokasi pengguna agar bypass loading GPS
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -6.200000, longitude: 106.816666 });

    // 2. Login sebagai warga
    await page.goto('/login');
    await page.getByPlaceholder(/Email/i).fill('warga@fs.id');
    await page.getByPlaceholder(/Password/i).fill('123456');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();

    // Tunggu redirect selesai — pastikan kita sudah meninggalkan halaman /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

    // 3. Buka halaman buat laporan banjir
    await page.goto('/report/new');
    await page.waitForLoadState('networkidle');

    // Langkah 1 — Lokasi: tunggu GPS mock terdeteksi
    await expect(page.getByText('Lokasi Ditemukan')).toBeVisible({ timeout: 15_000 });

    // Tunggu sampai peta selesai loading (dynamic import) agar DOM stabil
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Lanjut/i }).first().click();

    // Langkah 2 — Keparahan & Deskripsi
    await expect(page.getByRole('heading', { name: 'Tingkat Keparahan' })).toBeVisible();

    await page.getByRole('button', { name: /Ringan/i }).first().click();
    await page.locator('textarea#description').fill('Banjir setinggi betis, lalu lintas sedikit terhambat.');
    await page.getByRole('button', { name: /Lutut/i }).click();
    await page.getByRole('button', { name: /Lanjut ke Foto/i }).click();

    // Langkah 3 — Foto → Lewati
    await expect(page.getByRole('heading', { name: 'Foto Banjir' })).toBeVisible();
    await page.getByRole('button', { name: 'Lewati' }).click();

    // Langkah 4 — Tinjau & Kirim
    await expect(page.getByRole('heading', { name: 'Tinjau Laporan' })).toBeVisible();
    await page.getByRole('button', { name: /Kirim Laporan/i }).click();

    // 7. Sistem menyimpan laporan (Lolos Spam) dan menampilkan layar sukses
    await expect(page.getByRole('heading', { name: 'Laporan Terkirim!' })).toBeVisible({ timeout: 20_000 });
    reportsCreatedInPbi10Flow += 1;
  });

  test('TC-04: sistem menandai laporan kedua sebagai duplikat dan tampil Ditandai di /reports', async ({ page, context }) => {
    test.setTimeout(90_000);

    // Mock reverse geocoding agar instan
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ display_name: 'Jl. Mock, Jakarta', address: { road: 'Jl. Mock', city: 'Jakarta' } }),
      });
    });

    // Titik B: ~50 meter dari Titik A milik TC-03 (lat: -6.200000, lng: 106.816666)
    // Masih dalam radius ≤100m
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -6.200400, longitude: 106.816666 });

    // ========== LOGIN ==========
    await page.goto('/login');
    await page.getByPlaceholder(/Email/i).fill('warga@fs.id');
    await page.getByPlaceholder(/Password/i).fill('123456');
    await page.getByRole('button', { name: 'Masuk', exact: true }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });

    // ========== LAPORAN KEDUA (Titik B — ≤100m dari Titik A) ==========
    await page.goto('/report/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Lokasi Ditemukan')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Lanjut/i }).first().click();

    // Pilih tingkat keparahan
    await expect(page.getByRole('heading', { name: 'Tingkat Keparahan' })).toBeVisible();
    await page.getByRole('button', { name: /Sedang/i }).first().click();

    // Isi deskripsi
    await page.locator('textarea#description').fill(FLAGGED_DUPLICATE_DESCRIPTION);

    // Klik lanjut ke foto
    await page.getByRole('button', { name: /Lanjut ke Foto/i }).click();

    // Lewati foto
    await expect(page.getByRole('heading', { name: 'Foto Banjir' })).toBeVisible();
    await page.getByRole('button', { name: 'Lewati' }).click();

    // Tinjau & Kirim
    await expect(page.getByRole('heading', { name: 'Tinjau Laporan' })).toBeVisible();

    // Intercept response API untuk memastikan laporan DI-FLAGGED sebagai duplikat
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/reports/submit') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Kirim Laporan/i }).click(),
    ]);
    const json = await response.json();

    // Verifikasi: laporan harus ditandai sebagai duplikat oleh spam-detection
    expect(json.flagged).toBe(true);
    expect(json.status).toBe('flagged');
    expect(json.report_id).toBeTruthy();
    flaggedDuplicateReportId = json.report_id;
    reportsCreatedInPbi10Flow += 1;

    // UI tetap menampilkan sukses (laporan tetap tersimpan, hanya ditandai untuk review staf)
    await expect(page.getByRole('heading', { name: 'Laporan Terkirim!' })).toBeVisible({ timeout: 20_000 });

    // Bukti akhir lewat daftar laporan publik: laporan baru muncul di filter Ditandai.
    await page.goto('/reports?status=flagged');
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('select:has(option[value="flagged"])')).toHaveValue('flagged');

    const newReportCard = page.locator(`a[href="/report/${json.report_id}"]`);
    await expect(newReportCard).toBeVisible({ timeout: 15_000 });
    await expect(newReportCard.locator('.badge-status-flagged')).toHaveText('Ditandai');
  });

  test('TC-07: laporan flagged masuk ke antrian moderasi staf', async ({ page }) => {
    test.setTimeout(60_000);

    expect(flaggedDuplicateReportId).toBeTruthy();

    await login(page, 'staf');
    await page.goto('/staff/verification');
    await expect(page.getByRole('heading', { name: /Verifikasi Laporan/i }).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /^Semua$/i }).click();
    await page.getByRole('button', { name: /^Ditandai\s+\d+$/i }).click();
    await expect(page.getByRole('button', { name: /^Ditandai$/i })).toBeVisible();

    await page.getByPlaceholder(/Cari deskripsi, alamat, atau pelapor/i).fill(flaggedDuplicateReportId!);

    const flaggedReportCard = page
      .locator('button')
      .filter({ hasText: FLAGGED_DUPLICATE_DESCRIPTION })
      .filter({ hasText: 'Ditandai' })
      .first();

    await expect(flaggedReportCard).toBeVisible({ timeout: 15_000 });
    await expect(flaggedReportCard).toContainText('Spam/Duplikat');

    await flaggedReportCard.click();
    await expect(page.getByText('Laporan Ditandai oleh Sistem')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(FLAGGED_DUPLICATE_DESCRIPTION).last()).toBeVisible();
    await expect(page.getByText(/Keputusan Verifikasi/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terima', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tolak', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tinjau', exact: true })).toBeVisible();
  });

  test('TC-08: staf menerima laporan flagged sebagai terverifikasi', async ({ page }) => {
    test.setTimeout(60_000);

    expect(flaggedDuplicateReportId).toBeTruthy();

    await login(page, 'staf');
    await page.goto('/staff/verification');
    await expect(page.getByRole('heading', { name: /Verifikasi Laporan/i }).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /^Semua$/i }).click();
    await page.getByRole('button', { name: /^Ditandai\s+\d+$/i }).click();
    await page.getByPlaceholder(/Cari deskripsi, alamat, atau pelapor/i).fill(flaggedDuplicateReportId!);

    const flaggedReportCard = page
      .locator('button')
      .filter({ hasText: FLAGGED_DUPLICATE_DESCRIPTION })
      .filter({ hasText: 'Ditandai' })
      .first();

    await expect(flaggedReportCard).toBeVisible({ timeout: 15_000 });
    await flaggedReportCard.click();

    await expect(page.getByText('Laporan Ditandai oleh Sistem')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Terima', exact: true }).click();
    await page.getByPlaceholder(/Catatan verifikasi/i).fill('Laporan duplikat sudah ditinjau dan diterima staf.');

    const [verificationResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/verification') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kirim Keputusan', exact: true }).click(),
    ]);
    const verificationJson = await verificationResponse.json();

    expect(verificationResponse.ok()).toBe(true);
    expect(verificationJson.success).toBe(true);
    expect(verificationJson.decision).toBe('verified');

    await expect(page.getByText(/Hasil tidak ditemukan untuk/i)).toBeVisible({ timeout: 15_000 });

    await page.goto('/reports?status=verified');
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('select:has(option[value="verified"])')).toHaveValue('verified');

    const verifiedReportCard = page.locator(`a[href="/report/${flaggedDuplicateReportId}"]`);
    await expect(verifiedReportCard).toBeVisible({ timeout: 15_000 });
    await expect(verifiedReportCard.locator('.badge-status-verified')).toHaveText('Terverifikasi');
    await expect(verifiedReportCard.locator('.badge-status-flagged')).toHaveCount(0);
  });

  test('TC-09: staf menolak laporan flagged dengan alasan penolakan', async ({ page }) => {
    test.setTimeout(90_000);

    await login(page, 'warga');

    const flaggedResponse = await page.request.post('/api/reports/submit', {
      data: {
        lat: -6.200500,
        lng: 106.816666,
        severity: 'sedang',
        description: REJECTED_FLAGGED_DESCRIPTION,
        water_height_cm: 30,
        address: 'Jl. Mock Penolakan, Jakarta',
        is_surge_receding: false,
      },
    });
    const flaggedJson = await flaggedResponse.json();

    expect(flaggedResponse.ok()).toBe(true);
    expect(flaggedJson.flagged).toBe(true);
    expect(flaggedJson.status).toBe('flagged');
    expect(flaggedJson.report_id).toBeTruthy();
    reportsCreatedInPbi10Flow += 1;

    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.context().clearCookies();

    await login(page, 'staf');
    await page.goto('/staff/verification');
    await expect(page.getByRole('heading', { name: /Verifikasi Laporan/i }).first()).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /^Semua$/i }).click();
    await page.getByRole('button', { name: /^Ditandai\s+\d+$/i }).click();
    await page.getByPlaceholder(/Cari deskripsi, alamat, atau pelapor/i).fill(flaggedJson.report_id);

    const flaggedReportCard = page
      .locator('button')
      .filter({ hasText: REJECTED_FLAGGED_DESCRIPTION })
      .filter({ hasText: 'Ditandai' })
      .first();

    await expect(flaggedReportCard).toBeVisible({ timeout: 15_000 });
    await flaggedReportCard.click();

    const rejectionNote = 'Ditolak karena laporan terdeteksi duplikat dan tidak perlu diproses lanjut.';
    await expect(page.getByText('Laporan Ditandai oleh Sistem')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Tolak', exact: true }).click();
    await page.getByPlaceholder(/Catatan verifikasi/i).fill(rejectionNote);

    const [verificationResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/verification') && r.request().method() === 'POST'),
      page.getByRole('button', { name: 'Kirim Keputusan', exact: true }).click(),
    ]);
    const verificationJson = await verificationResponse.json();

    expect(verificationResponse.ok()).toBe(true);
    expect(verificationJson.success).toBe(true);
    expect(verificationJson.decision).toBe('rejected');

    await expect(page.getByText(/Hasil tidak ditemukan untuk/i)).toBeVisible({ timeout: 15_000 });

    await page.goto('/reports?status=rejected');
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('select:has(option[value="rejected"])')).toHaveValue('rejected');

    const rejectedReportCard = page.locator(`a[href="/report/${flaggedJson.report_id}"]`);
    await expect(rejectedReportCard).toBeVisible({ timeout: 15_000 });
    await expect(rejectedReportCard.locator('.badge-status-rejected')).toHaveText('Ditolak');
    await expect(rejectedReportCard.locator('.badge-status-flagged')).toHaveCount(0);

    await rejectedReportCard.click();
    await expect(page.getByText(rejectionNote)).toBeVisible({ timeout: 15_000 });
  });

  test('TC-05: lokasi lebih dari 100 meter tidak ter-flag dan tampil Menunggu di /reports', async ({ page, context }) => {
    test.setTimeout(90_000);

    // Mock reverse geocoding agar instan
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ display_name: 'Jl. Mock, Jakarta', address: { road: 'Jl. Mock', city: 'Jakarta' } }),
      });
    });

    // Titik C: >100 meter dari Titik A milik TC-03 dan Titik B milik TC-04.
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -6.202000, longitude: 106.816666 });

    await login(page, 'warga');

    await page.goto('/report/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Lokasi Ditemukan')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Lanjut/i }).first().click();

    await expect(page.getByRole('heading', { name: 'Tingkat Keparahan' })).toBeVisible();
    await page.getByRole('button', { name: /Ringan/i }).first().click();
    await page.getByRole('button', { name: /Mata Kaki/i }).click();

    const nonDuplicateDescription = 'Banjir terjadi di lokasi berbeda.';
    await page.locator('textarea#description').fill(nonDuplicateDescription);

    await page.getByRole('button', { name: /Lanjut ke Foto/i }).click();
    await expect(page.getByRole('heading', { name: 'Foto Banjir' })).toBeVisible();
    await page.getByRole('button', { name: 'Lewati' }).click();

    await expect(page.getByRole('heading', { name: 'Tinjau Laporan' })).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/reports/submit') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Kirim Laporan/i }).click(),
    ]);
    const json = await response.json();

    expect(json.flagged).toBe(false);
    expect(json.status).toBe('pending');
    expect(json.report_id).toBeTruthy();
    reportsCreatedInPbi10Flow += 1;

    await expect(page.getByRole('heading', { name: 'Laporan Terkirim!' })).toBeVisible({ timeout: 20_000 });

    // Bukti akhir lewat daftar laporan publik: laporan baru masuk sebagai laporan normal.
    await page.goto('/reports?status=pending');
    await expect(page.getByRole('heading', { name: 'Laporan Banjir' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('select:has(option[value="pending"])')).toHaveValue('pending');

    const newReportCard = page.locator(`a[href="/report/${json.report_id}"]`);
    await expect(newReportCard).toBeVisible({ timeout: 15_000 });
    await expect(newReportCard.locator('.badge-status-pending')).toHaveText('Menunggu');
    await expect(newReportCard.locator('.badge-status-flagged')).toHaveCount(0);
  });

  test('TC-06: rate limit menolak laporan ke-11 dalam 1 jam', async ({ page, context }) => {
    test.setTimeout(90_000);

    // Mock reverse geocoding agar instan saat laporan ke-11 dikirim lewat UI.
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ display_name: 'Jl. Mock, Jakarta', address: { road: 'Jl. Mock', city: 'Jakarta' } }),
      });
    });

    await login(page, 'warga');

    // Lanjutkan sampai total laporan tersimpan dalam run ini mencapai 10 laporan/jam.
    const additionalReportsNeeded = Math.max(0, 10 - reportsCreatedInPbi10Flow);
    for (let i = 1; i <= additionalReportsNeeded; i++) {
      const response = await page.request.post('/api/reports/submit', {
        data: {
          lat: -6.210000 - i * 0.001,
          lng: 106.816666,
          severity: i % 2 === 0 ? 'sedang' : 'ringan',
          description: `TC-06 laporan tambahan ${i}`,
          water_height_cm: i % 2 === 0 ? 30 : 10,
          address: `Jl. Mock Rate Limit ${i}, Jakarta`,
          is_surge_receding: false,
        },
      });
      const json = await response.json();

      expect(response.ok()).toBe(true);
      expect(json.success).toBe(true);
      expect(json.report_id).toBeTruthy();
      reportsCreatedInPbi10Flow += 1;
    }

    // Laporan ke-11 dikirim lewat UI agar bukti akhirnya berupa pesan error di halaman.
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -6.230000, longitude: 106.816666 });

    await page.goto('/report/new');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Lokasi Ditemukan')).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Lanjut/i }).first().click();

    await expect(page.getByRole('heading', { name: 'Tingkat Keparahan' })).toBeVisible();
    await page.getByRole('button', { name: /Ringan/i }).first().click();
    await page.getByRole('button', { name: /Mata Kaki/i }).click();
    await page.locator('textarea#description').fill(`TC-06 laporan ke-11 ditolak ${Date.now()}`);

    await page.getByRole('button', { name: /Lanjut ke Foto/i }).click();
    await expect(page.getByRole('heading', { name: 'Foto Banjir' })).toBeVisible();
    await page.getByRole('button', { name: 'Lewati' }).click();

    await expect(page.getByRole('heading', { name: 'Tinjau Laporan' })).toBeVisible();

    const [rejectedResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/reports/submit') && r.request().method() === 'POST'),
      page.getByRole('button', { name: /Kirim Laporan/i }).click(),
    ]);

    expect(rejectedResponse.status()).toBe(429);
    await expect(page.getByText(/Batas laporan tercapai \(maks 10 per jam\)\. Coba lagi nanti\./i)).toBeVisible({ timeout: 15_000 });
  });
});
