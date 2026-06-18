import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { createClient } from '@supabase/supabase-js';

/**
 * Sprint 2 — PBI-26 / FS-77 (Antrian Pemeriksaan Ulang Terjadwal).
 * Skenario Pengujian Lengkap:
 * - TC-32: Link Peninjauan Ulang tampil & mengarah ke antrean (Positive).
 * - TC-33: Halaman antrean menampilkan judul + daftar/empty (Positive).
 * - TC-34: Warga dilarang mengakses antrean recheck / dialihkan (Negative).
 * - TC-26-Exception-ScheduleVerification: Menjadwalkan ulang laporan pending staf & masuk antrean (Exception).
 * - TC-26-Negative-InvalidVerification: Validasi form kosong saat menjadwalkan peninjauan (Negative).
 * - TC-26-Exception-UnauthorizedAPI: Warga mencoba memintas API verifikasi secara langsung (Exception).
 */

import fs from 'fs';
import path from 'path';

// Parse .env manually for process.env in Playwright E2E environment
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.trim().split('=');
    if (parts.length >= 2 && !line.trim().startsWith('#')) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      process.env[key] = val;
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper untuk memastikan ada laporan pending di database
async function ensurePendingReportId(): Promise<string> {
  const { data: pendingReport } = await supabase
    .from('reports')
    .select('id')
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (pendingReport) {
    return pendingReport.id;
  }

  // Jika tidak ada pending, ambil laporan mana saja dan update statusnya ke pending untuk pengetesan
  const { data: anyReport } = await supabase
    .from('reports')
    .select('id')
    .limit(1)
    .single();

  if (!anyReport) {
    throw new Error('Database tidak memiliki data laporan sama sekali. Harap seed database terlebih dahulu.');
  }

  await supabase
    .from('reports')
    .update({ status: 'pending' })
    .eq('id', anyReport.id);

  // Hapus riwayat verifikasi lama agar bersih
  await supabase.from('verifications').delete().eq('report_id', anyReport.id);

  return anyReport.id;
}

test.describe('PBI-26 — Antrian Peninjauan Ulang', () => {

  test('TC-32: link Peninjauan Ulang tampil di halaman verifikasi & menuju antrian (Positive Case)', async ({ page }) => {
    await login(page, 'valerina_staf');
    await page.goto('/staff/verification');
    const link = page.getByRole('link', { name: /Peninjauan Ulang/i });
    await expect(link).toBeVisible({ timeout: 15_000 });
    await link.click();
    await expect(page).toHaveURL(/\/staff\/recheck/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Pemeriksaan Ulang Terjadwal/i })).toBeVisible({ timeout: 15_000 });
  });

  test('TC-33: halaman antrian recheck menampilkan judul + daftar/empty (Positive Case)', async ({ page }) => {
    await login(page, 'valerina_staf');
    await page.goto('/staff/recheck');
    await expect(page).toHaveURL(/\/staff\/recheck/);
    await expect(page.getByRole('heading', { name: /Pemeriksaan Ulang Terjadwal/i })).toBeVisible({ timeout: 15_000 });
    
    // Adaptif: ada item terjadwal ATAU empty-state
    await expect(
      page.getByText(/Tidak ada laporan terjadwal|Terlambat|peninjauan|jadwal/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('TC-34: warga tidak bisa mengakses antrian recheck - dialihkan (Negative Case)', async ({ page }) => {
    await login(page, 'valerina_warga');
    await page.goto('/staff/recheck');
    await expect(page).not.toHaveURL(/\/staff\/recheck/, { timeout: 15_000 });
    
    // Dialihkan ke beranda peta
    await expect(page.getByRole('link', { name: 'Peta', exact: true }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('TC-26-Exception-ScheduleVerification: staf berhasil menjadwalkan pemeriksaan ulang & masuk antrean (Exception Case)', async ({ page }) => {
    const reportId = await ensurePendingReportId();

    await login(page, 'valerina_staf');
    await page.goto(`/report/${reportId}`);

    // Pastikan panel verifikasi terlihat
    await expect(page.getByText(/Panel Verifikasi & Moderasi Staf/i)).toBeVisible({ timeout: 15_000 });

    // Pilih keputusan "Tinjau di Lapangan" (scheduled_check)
    await page.getByRole('button', { name: /Tinjau di Lapangan/i }).click();

    // Isi tanggal & waktu pemeriksaan ulang (besok)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const timezoneOffset = tomorrow.getTimezoneOffset() * 60_000;
    const tomorrowLocal = new Date(tomorrow.getTime() - timezoneOffset).toISOString().slice(0, 16);
    await page.locator('input[type="datetime-local"]').fill(tomorrowLocal);

    // Isi catatan moderasi (minimal 10 karakter)
    const noteText = 'Komentar recheck E2E Staf Valerina';
    await page.getByPlaceholder(/Jelaskan alasan persetujuan/i).fill(noteText);

    // Klik kirim keputusan verifikasi
    await page.getByRole('button', { name: /Kirim Keputusan Verifikasi/i }).click();

    // Verifikasi status laporan berubah menjadi "Sedang Ditinjau" di timeline/detail
    await expect(page.getByText(/Sedang Ditinjau/i).first()).toBeVisible({ timeout: 15_000 });

    // Buka halaman antrean recheck dan pastikan laporan tersebut muncul
    await page.goto('/staff/recheck');
    await page.reload();
    await expect(page.locator(`a[href="/report/${reportId}"]`)).toBeVisible({ timeout: 15_000 });
  });

  test('TC-26-Negative-InvalidVerification: staf ditolak menjadwalkan jika form tidak valid (Negative Case)', async ({ page }) => {
    const reportId = await ensurePendingReportId();

    await login(page, 'valerina_staf');
    await page.goto(`/report/${reportId}`);

    // Pastikan panel verifikasi terlihat
    await expect(page.getByText(/Panel Verifikasi & Moderasi Staf/i)).toBeVisible({ timeout: 15_000 });

    // Pilih keputusan "Tinjau di Lapangan" (scheduled_check)
    await page.getByRole('button', { name: /Tinjau di Lapangan/i }).click();

    // Skenario 1: Catatan kosong
    await page.getByPlaceholder(/Jelaskan alasan persetujuan/i).fill('');
    await page.getByRole('button', { name: /Kirim Keputusan Verifikasi/i }).click();

    // Verifikasi pesan error catatan wajib diisi
    await expect(page.getByText(/Catatan wajib diisi/i)).toBeVisible({ timeout: 10_000 });

    // Skenario 2: Catatan diisi, tetapi tanggal jadwal recheck kosong
    await page.getByPlaceholder(/Jelaskan alasan persetujuan/i).fill('Catatan valid lebih dari 10 karakter');
    // Hapus tanggal
    await page.locator('input[type="datetime-local"]').fill('');
    await page.getByRole('button', { name: /Kirim Keputusan Verifikasi/i }).click();

    // Verifikasi pesan error jadwal peninjauan wajib diisi
    await expect(page.getByText(/Jadwal peninjauan ulang wajib diisi/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TC-26-Exception-UnauthorizedAPI: warga ditolak mengakses API verifikasi secara langsung (Exception Case)', async ({ page }) => {
    const reportId = await ensurePendingReportId();

    // Login sebagai warga biasa
    await login(page, 'valerina_warga');
    await page.goto('/');

    // Kirim request POST ke API verifikasi secara langsung dari context halaman browser
    const responseStatus = await page.evaluate(async (repId) => {
      const res = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: repId,
          decision: 'scheduled_check',
          notes: 'Hack bypass attempt',
          scheduled_check_at: new Date().toISOString()
        })
      });
      return res.status;
    }, reportId);

    // Harus terblokir (403 Forbidden atau 401 Unauthorized)
    expect([401, 403]).toContain(responseStatus);
  });
});
