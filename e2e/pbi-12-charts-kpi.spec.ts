import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * Sprint 2 — PBI-12 / FS-12 (Grafik, KPI & Perbandingan Wilayah).
 * Sesuai UI saat ini: KPI = Total Laporan, Aktif, Terverifikasi, Kritis.
 * Tiap test berakhir pada teks yang terlihat di dashboard.
 */

test.describe('PBI-12 — Grafik, KPI & Perbandingan', () => {
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
        lat: -6.175000,
        lng: 106.827000,
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

    // 4. Reload dashboard agar data terbaru diambil dari Supabase.
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Total Laporan')).toBeVisible({ timeout: 15_000 });

    // 5. Verifikasi KPI "Aktif" bertambah minimal 1.
    const aktifCardAfter = page.locator('.card').filter({ hasText: 'Aktif' }).first();
    await expect(aktifCardAfter).toBeVisible({ timeout: 15_000 });
    const aktifValueAfter = parseInt(
      (await aktifCardAfter.locator('p').last().textContent()) ?? '0',
      10,
    );

    expect(
      aktifValueAfter,
      `KPI Aktif seharusnya bertambah: sebelum=${aktifValueBefore}, sesudah=${aktifValueAfter}`,
    ).toBeGreaterThan(aktifValueBefore);
  });
});
