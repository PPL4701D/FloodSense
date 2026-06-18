import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Muat .env.local ke process.env agar spec E2E yang butuh service-role Supabase
// (mis. pbi-16-push, pbi-26-recheck) dapat membaca env — Playwright tidak otomatis
// memuat .env.local seperti Next. Hanya mengisi key yang belum ada di process.env.
const envLocalPath = join(process.cwd(), '.env.local');
if (existsSync(envLocalPath)) {
  for (const line of readFileSync(envLocalPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

/**
 * Konfigurasi Playwright E2E — FloodSense (Sprint 1).
 *
 * Menjalankan test terhadap dev server Next.js (localhost:3000). Jika dev server
 * sudah berjalan, akan dipakai ulang; jika belum, Playwright menjalankannya.
 *
 * Akun uji (role): admin@fs.id / tlm@fs.id / staf@fs.id / warga@fs.id (password 123456).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:3000',
    // Interval antar-aksi (ms) untuk mode headed — set via env SLOWMO, mis. SLOWMO=800.
    launchOptions: { slowMo: Number(process.env.SLOWMO) || 0 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    // Izin & lokasi GPS default (area Bandung) untuk fitur peta/pelaporan.
    permissions: ['geolocation'],
    geolocation: { latitude: -6.9175, longitude: 107.6191 },
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
