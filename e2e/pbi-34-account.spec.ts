import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('PBI-34 v2 — Manajemen Akun', () => {

  test('TC-34-01 [+] halaman /settings/account menampilkan semua komponen keamanan', async ({ page }) => {
    // Login menggunakan akun warga khusus PBI 34
    await login(page, 'pbi34Warga');

    await page.goto('/settings/account');

    // Cek URL & Heading Keamanan Akun
    await expect(page).toHaveURL(/\/settings\/account/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Keamanan Akun/i })).toBeVisible({ timeout: 15_000 });

    // Cek Section Ganti Password beserta input-inputnya
    await expect(page.getByRole('heading', { name: /Ganti Password/i })).toBeVisible();
    const pwInputs = page.locator('input[type="password"]');
    await expect(pwInputs.nth(0)).toBeVisible({ timeout: 5_000 });
    await expect(pwInputs.nth(1)).toBeVisible();
    await expect(pwInputs.nth(2)).toBeVisible();
    await expect(page.getByRole('button', { name: /Simpan Password Baru/i })).toBeVisible();

    // Cek Section Keluar Semua Perangkat
    await expect(page.getByText(/Keluar dari Semua Perangkat/i)).toBeVisible();
    await expect(page.locator('.btn-ghost', { hasText: /^Keluar$/i })).toBeVisible();

    // Cek Section Hapus Akun
    await expect(page.getByRole('heading', { name: /Hapus Akun/i })).toBeVisible();
    await expect(page.locator('input[placeholder="Ketik HAPUS"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Hapus Akun Saya/i })).toBeVisible();
  });

  test('TC-34-02 [-] password baru kurang dari 8 karakter ditolak', async ({ page }) => {
    await login(page, 'pbi34Warga');
    await page.goto('/settings/account');

    await expect(page.getByRole('heading', { name: /Ganti Password/i })).toBeVisible({ timeout: 15_000 });

    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill('Test@1234!');
    await pwInputs.nth(1).fill('abc'); // Isi dengan password pendek
    await pwInputs.nth(2).fill('abc');

    const submitBtn = page.getByRole('button', { name: /Simpan Password Baru/i });
    await submitBtn.click();

    // Pastikan validasi client-side mendeteksi minimal 8 karakter
    await expect(page.getByText(/minimal 8 karakter/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/settings\/account/);
  });

  test('TC-34-03 [-] konfirmasi password tidak cocok ditolak', async ({ page }) => {
    await login(page, 'pbi34Warga');
    await page.goto('/settings/account');

    await expect(page.getByRole('heading', { name: /Ganti Password/i })).toBeVisible({ timeout: 15_000 });

    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill('Test@1234!');
    await pwInputs.nth(1).fill('PasswordBaru123!');
    await pwInputs.nth(2).fill('PasswordBeda999!'); // Password tidak cocok

    const submitBtn = page.getByRole('button', { name: /Simpan Password Baru/i });
    await submitBtn.click();

    // Pastikan muncul validasi tidak cocok
    await expect(page.getByText(/tidak cocok/i)).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/settings\/account/);
  });

  test('TC-34-04 [-] hapus akun tanpa ketik HAPUS memicu validasi', async ({ page }) => {
    await login(page, 'pbi34Warga');
    await page.goto('/settings/account');

    await expect(page.getByRole('heading', { name: /Hapus Akun/i })).toBeVisible({ timeout: 15_000 });

    const deleteInput = page.locator('input[placeholder="Ketik HAPUS"]');
    await deleteInput.fill(''); // Biarkan kosong

    const deleteBtn = page.getByRole('button', { name: /Hapus Akun Saya/i });
    await deleteBtn.click();

    // Pastikan muncul validasi error
    await expect(page.locator('p', { hasText: /^Ketik HAPUS untuk konfirmasi$/i })).toBeVisible({ timeout: 5_000 });
  });

  test('TC-34-05 [-] password lama salah menampilkan error dari server', async ({ page }) => {
    await login(page, 'pbi34Warga');
    await page.goto('/settings/account');

    await expect(page.getByRole('heading', { name: /Ganti Password/i })).toBeVisible({ timeout: 15_000 });

    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill('WrongPassword99!'); // Password lama salah
    await pwInputs.nth(1).fill('PasswordBaru123!');
    await pwInputs.nth(2).fill('PasswordBaru123!');

    const submitBtn = page.getByRole('button', { name: /Simpan Password Baru/i });
    await submitBtn.click();

    // Menampilkan pesan error dari backend
    await expect(page.getByText(/Password lama salah/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TC-34-06 [-] akses /settings/account tanpa login diredirect ke /login', async ({ page }) => {
    // Langsung akses halaman setting akun tanpa melakukan login helper
    await page.goto('/settings/account');

    // Harus langsung diredirect kembali ke halaman login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('#email')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#password')).toBeVisible({ timeout: 5_000 });
  });

  test('TC-34-07 [-] input konfirmasi hapus dengan huruf kecil "hapus" ditolak', async ({ page }) => {
    await login(page, 'pbi34Warga');
    await page.goto('/settings/account');

    await expect(page.getByRole('heading', { name: /Hapus Akun/i })).toBeVisible({ timeout: 15_000 });

    const deleteInput = page.locator('input[placeholder="Ketik HAPUS"]');
    await deleteInput.fill('hapus'); // Mengetik "hapus" dengan huruf kecil (seharusnya case-sensitive)

    const deleteBtn = page.getByRole('button', { name: /Hapus Akun Saya/i });
    await deleteBtn.click();

    // Harus tetap memicu validasi karena bukan huruf kapital HAPUS
    await expect(page.locator('p', { hasText: /^Ketik HAPUS untuk konfirmasi$/i })).toBeVisible({ timeout: 5_000 });
  });

});
