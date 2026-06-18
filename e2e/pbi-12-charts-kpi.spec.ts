import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Setup Supabase Client untuk verifikasi Ground Truth langsung ke Database
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const envVars = envContent.split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  return acc;
}, {} as Record<string, string>);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || envVars['NEXT_PUBLIC_SUPABASE_URL'] || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envVars['SUPABASE_SERVICE_ROLE_KEY'] || envVars['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Sprint 2 — PBI-12 / FS-12 (Grafik, KPI & Perbandingan Wilayah).
 * Sesuai UI saat ini: KPI = Total Laporan, Aktif, Terverifikasi, Kritis.
 * Tiap test berakhir pada teks yang terlihat di dashboard.
 */

test.describe('PBI-12 — Grafik, KPI & Perbandingan', () => {
  test.describe.configure({ mode: 'serial' });
  let sharedReportIdTC08: string | null = null;
  test('TC-01: KPI cards tampil sesuai dashboard', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Aktif', { exact: true })).toBeVisible();
    await expect(page.getByText('Terverifikasi').first()).toBeVisible();
    await expect(page.getByText('Kritis').first()).toBeVisible();
  });

  test('TC-02: grafik tren dan perbandingan antar wilayah ter-render', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });

    // Adaptif: tanpa data dashboard menampilkan empty-state.
    const empty = page.getByText('Belum Ada Laporan');
    if (await empty.count()) {
      await expect(empty.first()).toBeVisible();
      return;
    }
    await expect(page.getByRole('heading', { name: /Tren Laporan Harian/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Perbandingan Antar Wilayah/i })).toBeVisible();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-03: hover semua grafik dashboard menampilkan detail tooltip', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });

    const empty = page.getByText('Belum Ada Laporan');
    if (await empty.count()) {
      await expect(empty.first()).toBeVisible();
      return;
    }

    await expect(page.getByRole('heading', { name: /Tren Laporan Harian/i })).toBeVisible({ timeout: 15_000 });

    const charts = page.locator('.recharts-wrapper');
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThan(0);

    const hoverPoints = [
      [0.5, 0.5],
      [0.35, 0.5],
      [0.65, 0.5],
      [0.5, 0.35],
      [0.5, 0.65],
      [0.25, 0.45],
      [0.75, 0.45],
      [0.5, 0.25],
      [0.75, 0.5],
      [0.25, 0.5],
    ];

    for (let i = 0; i < chartCount; i++) {
      const chart = charts.nth(i);
      await chart.scrollIntoViewIfNeeded();
      await expect(chart).toBeVisible({ timeout: 15_000 });

      const box = await chart.boundingBox();
      if (!box) throw new Error(`Grafik ke-${i + 1} tidak memiliki area hover.`);

      let tooltipText = '';
      for (const [xRatio, yRatio] of hoverPoints) {
        await page.mouse.move(box.x + box.width * xRatio, box.y + box.height * yRatio);
        await page.waitForTimeout(150);

        const tooltips = page.locator('.recharts-tooltip-wrapper');
        const tooltipCount = await tooltips.count();
        for (let j = 0; j < tooltipCount; j++) {
          const tooltip = tooltips.nth(j);
          if (await tooltip.isVisible()) {
            tooltipText = ((await tooltip.textContent()) ?? '').trim();
            if (tooltipText.length > 0) break;
          }
        }
        if (tooltipText.length > 0) break;
      }

      expect(tooltipText, `Tooltip grafik ke-${i + 1} tidak muncul saat hover`).not.toBe('');
    }
  });

  test('TC-04: filter rentang waktu memperbarui chart dashboard', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Rentang Waktu')).toBeVisible();

    await page.getByRole('button', { name: '30 hari', exact: true }).click();
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/, { timeout: 10_000 });
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });

    const empty = page.getByText('Belum Ada Laporan');
    if (await empty.count()) {
      await expect(empty.first()).toBeVisible();
      return;
    }

    await expect(page.getByRole('heading', { name: /Tren Laporan Harian/i })).toBeVisible();
    const trendChart = page.locator('.recharts-wrapper').first();
    await expect(trendChart).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('heading', { name: /Perbandingan Antar Wilayah/i })).toBeVisible();
  });

  test('TC-05: mode perbandingan wilayah dapat dipilih dan chart ikut berubah', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Total Laporan|Belum Ada Laporan/).first()).toBeVisible({ timeout: 15_000 });

    const empty = page.getByText('Belum Ada Laporan');
    if (await empty.count()) {
      // Tanpa data → mode perbandingan tidak tampil; tetap akhiri pada teks terlihat.
      await expect(empty.first()).toBeVisible();
      return;
    }

    const comparisonCard = page.locator('.card').filter({ hasText: 'Perbandingan Antar Wilayah' }).first();
    await expect(comparisonCard).toBeVisible({ timeout: 15_000 });

    const compare = comparisonCard.locator('select[title="Mode perbandingan"]');
    await expect(compare).toBeVisible();
    await expect(compare.locator('option')).toHaveText([
      'Jumlah Laporan',
      'Keparahan Berat+',
      'Laporan Aktif',
      'Rata-rata Ketinggian',
      '% Terverifikasi',
    ]);

    await expect(compare).toHaveValue('total');
    await compare.selectOption('severe');
    await expect(compare).toHaveValue('severe');
    await compare.selectOption('avg_water');
    await expect(compare).toHaveValue('avg_water');
    await expect(page.getByRole('heading', { name: /Perbandingan Antar Wilayah/i })).toBeVisible({ timeout: 10_000 });

    const noRegionData = comparisonCard.getByText(/Belum ada laporan berwilayah pada filter ini/i);
    if (await noRegionData.count()) {
      await expect(noRegionData).toBeVisible();
      return;
    }

    const comparisonChart = comparisonCard.locator('.recharts-wrapper');
    await expect(comparisonChart).toBeVisible({ timeout: 15_000 });

    const bars = comparisonCard.locator('.recharts-bar-rectangle');
    await expect(bars.first()).toBeVisible({ timeout: 15_000 });
    expect(await bars.count()).toBeGreaterThan(0);
  });

  test('TC-06: filter tanpa data berakhir di Belum Ada Laporan', async ({ page }) => {
    await login(page, 'admin');
    await page.goto('/dashboard?from=1900-01-01&to=1900-01-02');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Tidak ada laporan banjir pada wilayah & rentang waktu yang dipilih/i)).toBeVisible();
    await expect(page.getByText(/Belum ada laporan/i)).toBeVisible({ timeout: 15_000 });
  });

  test('TC-07: rentang waktu terbalik (from > to) tidak menyebabkan error', async ({ page }) => {
    await login(page, 'admin');
    // Sengaja memberikan from yang lebih baru dari to (reversed range).
    await page.goto('/dashboard?from=2025-12-31&to=2025-01-01');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    // Dashboard harus tetap me-render KPI cards tanpa crash / layar putih.
    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });

    // Dengan rentang terbalik, Supabase mengembalikan 0 baris dan trend loop kosong,
    // sehingga KPI bernilai 0 dan empty state harus muncul.
    const totalValue = page.locator('.card').filter({ hasText: 'Total Laporan' }).locator('p').last();
    await expect(totalValue).toHaveText('0');

    await expect(page.getByText(/Belum Ada Laporan/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Tidak ada laporan banjir pada wilayah & rentang waktu yang dipilih/i)).toBeVisible();

    // Pastikan tidak ada error JavaScript yang tidak tertangani.
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    // Beri waktu singkat untuk memastikan tidak ada error async yang muncul.
    await page.waitForTimeout(2_000);
    expect(errors, 'Terdapat JavaScript error pada halaman').toHaveLength(0);
  });

  test('TC-08: KPI Aktif bertambah setelah laporan baru dibuat', async ({ page }) => {
    test.setTimeout(90_000);

    // 1. Login sebagai admin dan buka dashboard.
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });

    // 2. Catat nilai KPI "Aktif" saat ini.
    const aktifCard = page.locator('.card').filter({ hasText: 'Aktif' }).first();
    await expect(aktifCard).toBeVisible({ timeout: 15_000 });
    const aktifValueBefore = parseInt(
      (await aktifCard.locator('p').last().textContent()) ?? '0',
      10,
    );

    // 3. Buat laporan baru via API (status otomatis = pending → masuk KPI "Aktif").
    //    Menggunakan API langsung agar test tetap cepat tanpa melewati wizard 4 langkah.
    const submitResponse = await page.request.post('/api/reports/submit', {
      data: {
        lat: -6.175000 + (Math.random() * 0.01),
        lng: 106.827000 + (Math.random() * 0.01),
        severity: 'ringan',
        description: `TC-08 laporan integrasi KPI ${Date.now()}`,
        water_height_cm: 15,
        address: 'Jl. Test KPI Dashboard, Jakarta',
        is_surge_receding: false,
      },
    });
    const submitJson = await submitResponse.json();
    expect(submitResponse.ok(), 'Gagal membuat laporan baru via API').toBe(true);
    expect(submitJson.report_id).toBeTruthy();
    sharedReportIdTC08 = submitJson.report_id;

    // 4. Reload dashboard agar data terbaru diambil dari Supabase.
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });

    // 5. Verifikasi KPI "Aktif" bertambah minimal 1.
    await expect(async () => {
      const aktifCardAfter = page.locator('.card').filter({ hasText: 'Aktif' }).first();
      await expect(aktifCardAfter).toBeVisible();
      const aktifValueAfter = parseInt((await aktifCardAfter.locator('p').last().textContent()) ?? '0', 10);
      expect(
        aktifValueAfter,
        `KPI Aktif seharusnya bertambah: sebelum=${aktifValueBefore}, sesudah=${aktifValueAfter}`,
      ).toBeGreaterThan(aktifValueBefore);
    }).toPass({ timeout: 15_000 });
  });

  test('TC-09: KPI Terverifikasi bertambah setelah laporan diverifikasi', async ({ page }) => {
    let reportIdToVerify = sharedReportIdTC08;

    // Login sebagai admin untuk semua operasi API (pembuatan & verifikasi)
    await login(page, 'admin');

    // Jika user me-run TC-09 secara individual (tanpa TC-08), buat laporan sementara
    if (!reportIdToVerify) {
      const submitResponse = await page.request.post('/api/reports/submit', {
        data: {
          lat: -6.175000 + (Math.random() * 0.01),
          lng: 106.827000 + (Math.random() * 0.01),
          severity: 'ringan',
          description: `TC-09 laporan mandiri ${Date.now()}`,
          water_height_cm: 15,
          address: 'Jl. Test KPI Dashboard, Jakarta',
          is_surge_receding: false,
        },
      });
      const submitJson = await submitResponse.json();
      reportIdToVerify = submitJson.report_id;
    }

    // 1. Ambil nilai KPI "Terverifikasi" sebelum diverifikasi
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    
    const verifCardBefore = page.locator('.card').filter({ hasText: 'Terverifikasi' }).first();
    await expect(verifCardBefore).toBeVisible({ timeout: 15_000 });
    const verifValueBefore = parseInt((await verifCardBefore.locator('p').last().textContent()) ?? '0', 10);

    // 2. Modifikasi Data: Verifikasi laporan dari TC-08 menggunakan API staff
    const verifyResponse = await page.request.post('/api/verification', {
      data: {
        report_id: reportIdToVerify,
        decision: 'verified',
        notes: 'TC-09 Automated Verification',
      },
    });
    expect(verifyResponse.ok(), 'Gagal memverifikasi laporan via API').toBeTruthy();

    // 3. Reload dashboard
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    // 4. Cek KPI "Terverifikasi" setelah laporan diverifikasi
    await expect(async () => {
      const verifCardAfter = page.locator('.card').filter({ hasText: 'Terverifikasi' }).first();
      await expect(verifCardAfter).toBeVisible();
      const verifValueAfter = parseInt((await verifCardAfter.locator('p').last().textContent()) ?? '0', 10);
      expect(
        verifValueAfter,
        `KPI Terverifikasi seharusnya bertambah: sebelum=${verifValueBefore}, sesudah=${verifValueAfter}`,
      ).toBeGreaterThan(verifValueBefore);
    }).toPass({ timeout: 15_000 });
  });

  test('TC-10: KPI Kritis bertambah setelah laporan kondisi kritis dibuat', async ({ page }) => {
    // 1. Catat KPI "Kritis" sebelum modifikasi
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    const kritisCardBefore = page.locator('.card').filter({ hasText: 'Kritis' }).first();
    await expect(kritisCardBefore).toBeVisible({ timeout: 15_000 });
    const kritisValueBefore = parseInt((await kritisCardBefore.locator('p').last().textContent()) ?? '0', 10);

    // 2. Buat laporan baru dengan tingkat keparahan "sangat_berat" (Kritis)
    // Koordinat dibedakan (-6.200, 106.850) agar tidak tertabrak deteksi spam PBI-10
    const submitResponse = await page.request.post('/api/reports/submit', {
      data: {
        lat: -6.200000 + (Math.random() * 0.01),
        lng: 106.850000 + (Math.random() * 0.01),
        severity: 'sangat_berat',
        description: `TC-10 laporan kritis (sangat berat) ${Date.now()}`,
        water_height_cm: 200,
        address: 'Jl. Test Kritis Dashboard, Jakarta',
        is_surge_receding: false,
      },
    });
    expect(submitResponse.ok(), 'Gagal membuat laporan kritis via API').toBe(true);

    // 3. Reload dashboard
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    // 4. Pastikan KPI "Kritis" bertambah minimal 1
    await expect(async () => {
      const kritisCardAfter = page.locator('.card').filter({ hasText: 'Kritis' }).first();
      await expect(kritisCardAfter).toBeVisible();
      const kritisValueAfter = parseInt((await kritisCardAfter.locator('p').last().textContent()) ?? '0', 10);
      expect(
        kritisValueAfter,
        `KPI Kritis seharusnya bertambah: sebelum=${kritisValueBefore}, sesudah=${kritisValueAfter}`,
      ).toBeGreaterThan(kritisValueBefore);
    }).toPass({ timeout: 15_000 });
  });

  test('TC-11: Grafik Tren Harian (Tooltip) menampilkan data akurat dari Database', async ({ page }) => {
    // 1. Ambil Ground Truth dari Supabase untuk hari ini
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayLocalStr = `${y}-${m}-${day}`;
    
    // Konversi ke UTC untuk query Supabase (Sesuai cara komponen mem-filter)
    const todayStartUtc = new Date(todayLocalStr + 'T00:00:00').toISOString();
    const todayEndUtc = new Date(todayLocalStr + 'T23:59:59').toISOString();

    const { data: dbRows } = await supabase
      .from('reports')
      .select('status')
      .gte('created_at', todayStartUtc)
      .lte('created_at', todayEndUtc);

    const rows = dbRows ?? [];
    const expectedTotal = rows.length;
    const expectedVerified = rows.filter(r => r.status === 'verified').length;

    // 2. Login dan buka dashboard
    await login(page, 'admin');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });

    // 3. Hover grafik Tren Harian
    const chartLocator = page.locator('.recharts-wrapper').first();
    await expect(chartLocator).toBeVisible({ timeout: 15_000 });

    const box = await chartLocator.boundingBox();
    expect(box, 'Grafik Tren tidak ditemukan di DOM').toBeTruthy();
    if (!box) return;

    // Menggerakkan mouse ke arah kanan (titik terbaru / hari ini)
    await page.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2);
    await page.waitForTimeout(1000); // Tunggu animasi tooltip

    // 4. Cek Tooltip
    const tooltip = page.locator('.recharts-tooltip-wrapper').first();
    await expect(tooltip).toBeVisible({ timeout: 5000 });
    
    const tooltipText = await tooltip.innerText(); // innerText mempertahankan baris baru
    
    // 5. Verifikasi Tooltip mengandung angka Total dan Terverifikasi yang sesuai dengan DB
    // Regex digunakan untuk mencocokkan "Total : 23" atau "Total: 23"
    const totalMatch = tooltipText.match(/Total\s*:\s*(\d+)/i);
    const verifMatch = tooltipText.match(/Terverifikasi\s*:\s*(\d+)/i);

    expect(totalMatch, `Tulisan "Total" tidak ditemukan di tooltip. Isi tooltip: ${tooltipText}`).toBeTruthy();
    expect(verifMatch, `Tulisan "Terverifikasi" tidak ditemukan di tooltip. Isi tooltip: ${tooltipText}`).toBeTruthy();

    const uiTotal = parseInt(totalMatch![1], 10);
    const uiVerified = parseInt(verifMatch![1], 10);

    expect(uiTotal, `Data Total Laporan di Tooltip (${uiTotal}) harus cocok dengan Ground Truth Database (${expectedTotal})`).toBe(expectedTotal);
    expect(uiVerified, `Data Terverifikasi di Tooltip (${uiVerified}) harus cocok dengan Ground Truth Database (${expectedVerified})`).toBe(expectedVerified);
  });
});
