import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { openFirstReport } from './helpers/nav';

/**
 * Sprint 2 — PBI-25 / FS-76 (Komentar & Diskusi pada Laporan).
 * Pengujian lengkap alur Komentar dan Diskusi (Melihat kolom diskusi, Pengunjung tanpa login,
 * Kirim komentar optimistic, Batas karakter komentar, Proteksi Spam, dan Soft-Delete).
 * Menggunakan akun dedicated: valerina.warga@fs.id
 */

test.describe('PBI-25 — Komentar Laporan', () => {

  test('TC-30: user login melihat bagian Diskusi + form komentar (Positive Case)', async ({ page }) => {
    await login(page, 'valerina_warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    // Pastikan judul bagian diskusi tampil
    await expect(page.getByText(/Diskusi/i).first()).toBeVisible({ timeout: 15_000 });
    
    // Form komentar (textarea) tersedia untuk user login.
    await expect(page.getByPlaceholder(/Tambahkan informasi atau konfirmasi kondisi/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TC-30-Negative: pengunjung tanpa login tidak bisa menulis komentar (Negative Case)', async ({ page }) => {
    // Membuka detail laporan langsung sebagai guest (tidak login)
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    // Bagian diskusi tetap terlihat (publik)
    await expect(page.getByText(/Diskusi/i).first()).toBeVisible({ timeout: 15_000 });

    // Textarea input komentar TIDAK boleh terlihat
    await expect(page.getByPlaceholder(/Tambahkan informasi atau konfirmasi kondisi/i)).not.toBeVisible();

    // Verifikasi teks pemberitahuan untuk masuk / login
    await expect(page.getByText(/Masuk/i)).toBeVisible();
    await expect(page.getByText(/untuk ikut berdiskusi/i)).toBeVisible();
  });

  test('TC-31: kirim komentar tampil optimistic di daftar (Positive Case)', async ({ page }) => {
    await login(page, 'valerina_warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    const box = page.getByPlaceholder(/Tambahkan informasi atau konfirmasi kondisi/i);
    await box.scrollIntoViewIfNeeded();

    const msg = `Komentar E2E Valerina ${Date.now()}`;
    await box.fill(msg);
    await page.getByRole('button', { name: /Kirim/i }).first().click();

    // Komentar baru langsung tampil (teks unik terlihat di halaman secara optimistic).
    await expect(page.getByText(msg)).toBeVisible({ timeout: 15_000 });
    
    // Form input otomatis dikosongkan setelah kirim
    await expect(box).toHaveValue('');
  });

  test('TC-31-Negative: validasi komentar kosong atau lebih dari 500 karakter (Negative Case)', async ({ page }) => {
    await login(page, 'valerina_warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    const box = page.getByPlaceholder(/Tambahkan informasi atau konfirmasi kondisi/i);
    await box.scrollIntoViewIfNeeded();

    // Skenario 1: Input kosong -> Tombol kirim dinonaktifkan
    await box.fill('   '); // whitespace saja
    const sendBtn = page.getByRole('button', { name: /Kirim/i }).first();
    await expect(sendBtn).toBeDisabled();

    // Skenario 2: Input lebih dari 500 karakter -> Muncul pesan error
    // Hapus batasan maxlength browser terlebih dahulu agar bisa menginput > 500 karakter
    await page.evaluate(() => {
      const el = document.querySelector('textarea');
      if (el) el.removeAttribute('maxlength');
    });
    const longMsg = 'a'.repeat(501);
    await box.fill(longMsg);
    await expect(sendBtn).toBeEnabled(); // Tombol kirim aktif tetapi validasi error akan muncul setelah diklik
    await sendBtn.click();

    // Verifikasi munculnya pesan kesalahan panjang karakter
    await expect(page.getByText(/Maksimal 500 karakter/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TC-25-Exception-Spam: proteksi spamming/throttling 10 detik (Exception Case)', async ({ page }) => {
    await login(page, 'valerina_warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    const box = page.getByPlaceholder(/Tambahkan informasi atau konfirmasi kondisi/i);
    await box.scrollIntoViewIfNeeded();

    // Kirim komentar pertama
    const msg1 = `Pesan Pertama E2E ${Date.now()}`;
    await box.fill(msg1);
    await page.getByRole('button', { name: /Kirim/i }).first().click();
    await expect(page.getByText(msg1)).toBeVisible({ timeout: 15_000 });
    await expect(box).toHaveValue('');

    // Kirim komentar kedua secara instan (kurang dari 10 detik)
    const msg2 = `Pesan Kedua E2E ${Date.now()}`;
    await box.fill(msg2);
    await page.getByRole('button', { name: /Kirim/i }).first().click();

    // Verifikasi munculnya peringatan throttling
    await expect(page.getByText(/Tunggu beberapa detik sebelum berkomentar lagi/i)).toBeVisible({ timeout: 10_000 });
  });

  test('TC-25-Exception-SoftDelete: penghapusan komentar sendiri / soft-delete (Exception Case)', async ({ page }) => {
    await login(page, 'valerina_warga');
    const ok = await openFirstReport(page);
    test.skip(!ok, 'Tidak ada laporan untuk diuji');

    const box = page.getByPlaceholder(/Tambahkan informasi atau konfirmasi kondisi/i);
    await box.scrollIntoViewIfNeeded();

    // Tulis komentar baru
    const msg = `Komentar Uji Hapus ${Date.now()}`;
    await box.fill(msg);
    await page.getByRole('button', { name: /Kirim/i }).first().click();
    
    // Pastikan komentar tampil
    await expect(page.getByText(msg)).toBeVisible({ timeout: 15_000 });

    // Temukan baris komentar tersebut dan klik tombol Hapus (ikon Trash)
    const commentRow = page.locator('div').filter({ hasText: msg }).last();
    const deleteBtn = commentRow.getByTitle('Hapus');
    await expect(deleteBtn).toBeVisible({ timeout: 5000 });
    await deleteBtn.click();

    // Verifikasi komentar tersebut mengalami soft-delete (teks asli hilang, teks "Komentar dihapus" muncul)
    await expect(page.getByText(msg)).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Komentar dihapus/i).last()).toBeVisible({ timeout: 10_000 });
  });
});
