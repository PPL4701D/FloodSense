import { defineConfig, devices } from '@playwright/test';

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
