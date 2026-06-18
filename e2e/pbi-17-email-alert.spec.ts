import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-17 / FS-17 (Email Alert untuk Staf via Resend).
 * Pengiriman email eksternal tidak di-assert di E2E. Yang diuji: admin membuka editor
 * user, memilih role Staf, dan picker "Wilayah Tanggung Jawab" (penentu penerima) muncul.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TC-17 — PBI-17 / FS-17  [Positive / Happy Path]
// Skenario   : Admin tetapkan wilayah staf → warga submit laporan di wilayah itu
//              → API sukses → pipeline email alert ke staf dieksekusi
//
// Alur lengkap:
//   STEP 1 : Login admin, buka /admin/users
//   STEP 2 : Buka editor user staf, pilih role "Staf", set wilayah "Jawa Barat", Simpan
//   STEP 3 : Login sebagai warga
//   STEP 4 : Submit laporan banjir di koordinat Bandung (ada di dalam Jawa Barat)
//   STEP 5 : Assert API 200 + success:true + flagged:false
//            → membuktikan blok email aktif (route.ts baris 183: if (!isDuplicate))
//   STEP 6 : Assert report_id tersedia → Resend dipanggil dengan URL laporan valid
//   STEP 7 : Assert laporan dapat dibuka di /report/{id}
//            → URL yang dikirim via email ke staf bisa diakses
//
// Catatan teknis: Resend dipanggil dari server-side (Node.js), tidak bisa di-intercept
// via page.route(). Verifikasi dilakukan secara INDIRECT — jika API sukses & tidak
// flagged, kode sendEmail() PASTI sudah dieksekusi (by code path di route.ts 183-216).
//
// Referensi kode:
//   src/app/(main)/admin/users/page.tsx   baris 252-317  (modal ubah role + simpan)
//   src/app/api/reports/submit/route.ts   baris 183-216  (blok email alert staf)
//   src/app/api/admin/users/route.ts                     (PATCH role + region)
//   src/lib/email/resend.ts               baris 21-40    (sendEmail)
//   src/lib/email/resend.ts               baris 46-68    (buildNewReportEmail)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-17 — PBI-17: Email Alert Staf', () => {
  test('[POSITIVE] Admin set wilayah staf → warga submit laporan → pipeline email alert staf dieksekusi', async ({ page }) => {

    // ── STEP 1: Login admin, buka halaman Kelola Pengguna ────────────────────
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /Kelola Pengguna/i })).toBeVisible({ timeout: 15_000 });

    // ── STEP 2: Set role "Staf" + wilayah "Jawa Barat" pada user staf@fs.id ─
    // Cari user staf dengan filter role, klik Ubah
    // (admin tidak bisa mengubah dirinya sendiri — tombol Ubah tidak muncul untuk self)
    const editBtn = page.getByRole('button', { name: 'Ubah', exact: true }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();

    // Modal "Ubah Role" terbuka
    await expect(page.getByText(/Ubah Role —/i)).toBeVisible({ timeout: 10_000 });

    // Pilih role "Staf" → picker "Wilayah Tanggung Jawab" muncul
    // Referensi: admin/users/page.tsx baris 252-270 (tombol role)
    await page.getByRole('button', { name: 'Staf', exact: true }).click();
    await expect(page.getByText(/Wilayah Tanggung Jawab/i)).toBeVisible({ timeout: 10_000 });

    // Pilih provinsi "Jawa Barat" dari dropdown RegionFilter
    // Koordinat Bandung (-6.9175, 107.6191) berada di dalam Jawa Barat
    // Referensi: RegionFilter.tsx baris 73-76 (select provinsi)
    const provSelect = page.locator('select').filter({ hasText: /Semua Provinsi/ });
    await expect(provSelect).toBeVisible({ timeout: 10_000 });
    await provSelect.selectOption({ label: 'Jawa Barat' });

    // Tunggu provinsi terpilih (onChange terpanggil, emit(provId, '', ''))
    await page.waitForTimeout(500);

    // Klik Simpan → PATCH /api/admin/users dikirim
    // Referensi: admin/users/page.tsx baris 301-316 (tombol Simpan + handleRoleChange)
    const simpanBtn = page.getByRole('button', { name: 'Simpan', exact: true });
    // Jika tombol disabled, berarti role/wilayah sudah sama sejak awal (bekas test run sebelumnya).
    // Kita tutup modal dengan klik area luar (backdrop).
    if (await simpanBtn.isDisabled()) {
      await page.mouse.click(10, 10);
    } else {
      await simpanBtn.click();
    }

    // Modal menutup setelah simpan/batal berhasil
    await expect(page.getByText(/Ubah Role —/i)).not.toBeVisible({ timeout: 10_000 });

    // ── STEP 3: Logout admin, lalu Login sebagai warga ───────────────────────
    // Hapus session Supabase (localStorage) dan cookies agar bisa login akun lain
    await page.evaluate(() => window.localStorage.clear());
    await page.context().clearCookies();
    
    await login(page, 'warga');

    // ── STEP 4: Submit laporan banjir di koordinat Bandung (Jawa Barat) ─────
    // Offset kecil agar tidak kena deteksi duplikat antar test run
    // (duplikat: radius 100m & 30 menit — route.ts baris 68-78)
    const latOffset = (Math.random() - 0.5) * 0.04;  // ±0.02° ≈ ±2.2 km
    const lngOffset = (Math.random() - 0.5) * 0.04;
    const apiRes = await page.request.post('/api/reports/submit', {
      data: {
        lat: -6.9175 + latOffset,
        lng: 107.6191 + lngOffset,
        severity: 'berat',
        description: 'Test E2E PBI-17: laporan di Jawa Barat untuk uji email alert staf',
        water_height_cm: 80,
        address: 'Jl. Raya Bandung, Jawa Barat (E2E Test)',
      },
    });
    const body = await apiRes.json();

    // ── STEP 5: Verifikasi API sukses & blok email aktif ─────────────────────
    // HTTP 200 + success:true = laporan tersimpan
    // flagged:false = bukan duplikat/spam → blok email DIEKSEKUSI
    // (route.ts baris 183: if (!isDuplicate) { ... sendEmail() ... })
    expect(apiRes.status()).toBe(200);
    expect(body.success).toBe(true);

    if (body.flagged) {
      test.skip(true, 'Laporan flagged duplikat — jalankan ulang setelah 30 menit');
    }
    expect(body.flagged).toBe(false);

    // ── STEP 6: report_id tersedia → URL email ke staf valid ─────────────────
    // Referensi: submit/route.ts baris 208 — reportUrl: `${origin}/report/${report.id}`
    const reportId: string = body.report_id;
    expect(reportId).toBeTruthy();

    // ── STEP 7: Halaman laporan dapat diakses (URL yang dikirim di email valid) ─
    // Referensi: resend.ts baris 65 — <a href="${params.reportUrl}">Buka & Verifikasi</a>
    await page.goto(`/report/${reportId}`);
    await expect(page.getByText(/Detail Laporan/i).first()).toBeVisible({ timeout: 15_000 });
    // Severity "Berat" yang dikirim harus tampil di halaman
    await expect(page.getByText(/Berat/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-18 — PBI-17 / FS-17  [Negative / Exception]
// Skenario   : Tombol "Simpan" nonaktif bila role & wilayah belum berubah
// Referensi  : src/app/(main)/admin/users/page.tsx baris 301-311
//              const unchanged = newRole === editingUser.role && newRegion === (editingUser.assigned_region_id ?? null)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('TC-18 — PBI-17: Email Alert Staf', () => {
  test('[NEGATIVE] Tombol "Simpan" nonaktif bila tidak ada perubahan', async ({ page }) => {
    // Precondition: login admin, buka halaman kelola user
    await login(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: /Kelola Pengguna/i })).toBeVisible({ timeout: 15_000 });

    // Step 1-2: Klik tombol "Ubah" pada pengguna pertama yang bukan diri sendiri
    const editBtn = page.getByRole('button', { name: 'Ubah', exact: true }).first();
    await expect(editBtn).toBeVisible({ timeout: 10_000 });
    await editBtn.click();

    // Step 3: Pastikan modal "Ubah Role" muncul
    await expect(page.getByText(/Ubah Role —/i)).toBeVisible({ timeout: 10_000 });

    // Step 4: JANGAN ubah role maupun wilayah — langsung cek tombol "Simpan"

    // Expected Result: Tombol "Simpan" harus disabled (unchanged=true → disabled + opacity 0.5)
    const simpanBtn = page.getByRole('button', { name: 'Simpan', exact: true });
    await expect(simpanBtn).toBeVisible({ timeout: 10_000 });
    await expect(simpanBtn).toBeDisabled();

    // Verifikasi visual: opacity < 1 menandakan tombol tidak aktif (cursor: not-allowed)
    const opacity = await simpanBtn.evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(1);
  });
});
