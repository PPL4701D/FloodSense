import { test, expect, Page } from '@playwright/test';

/**
 * Sprint 2 — PBI-27 / FS-72 (Reputasi, Lencana & Papan Peringkat).
 *
 * Memakai AKUN KHUSUS reputasi (dibuat di DB testing, skor tetap) agar tidak
 * mengotori akun bersama (warga@fs.id) yang dipakai PBI lain. Semua password 123456:
 *   rep.pahlawan@fs.id = 120 (Pahlawan Banjir) · rep.andal@fs.id = 60 (Andal)
 *   rep.kontributor@fs.id = 25 (Kontributor) · rep.pemula@fs.id = 9 (Pemula)
 *   rep.minus@fs.id = -3 (skor negatif → tetap Pemula/clamp)
 *
 * 2 positive (profil + papan peringkat) + 4 negative/exception (di luar happy-path).
 * Tier: Pemula 0-9 · Kontributor 10-49 · Andal 50-99 · Pahlawan Banjir >=100.
 */

async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('123456');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

test.describe('PBI-27 — Reputasi & Leaderboard', () => {

  // ============================ POSITIVE ============================

  test('P1 (TC-35): profil menampilkan poin, tier, & progress sesuai reputasi (Kontributor 25)', async ({ page }) => {
    // 1-6. Login akun reputasi tier Kontributor (skor 25).
    await loginAs(page, 'rep.kontributor@fs.id');
    // 7. Buka halaman Profil.
    await page.goto('/profile');
    // 8. Bagian reputasi tampil.
    await expect(page.getByText('Reputasi').first()).toBeVisible({ timeout: 15_000 });
    // 9. Angka poin "25 poin" tampil pada lencana.
    await expect(page.getByText(/25 poin/i).first()).toBeVisible();
    // 10. Lencana tier "Kontributor" tampil (sesuai skor 25).
    await expect(page.getByText('Kontributor').first()).toBeVisible();
    // 11. Progress menuju tier berikutnya tampil. (bukti akhir terlihat)
    await expect(page.getByText(/poin lagi menuju tier berikutnya/i)).toBeVisible();
  });

  test('P2 (TC-36): papan peringkat terurut skor + tier + medali top-3 + highlight "(Anda)"', async ({ page }) => {
    // 1-6. Login sebagai rep.pemula (akan jadi baris ber-highlight "(Anda)").
    await loginAs(page, 'rep.pemula@fs.id');
    // 7. Buka papan peringkat.
    await page.goto('/leaderboard');
    // 8. Heading tampil.
    await expect(page.getByRole('heading', { name: /Papan Peringkat/i })).toBeVisible({ timeout: 15_000 });
    // 9. Skor puncak (120) tampil.
    await expect(page.getByText('120', { exact: true })).toBeVisible();
    // 10. Urutan menurun: Pahlawan(120) > Andal(60) > Kontributor(25) — cek posisi vertikal.
    const yPahlawan = (await page.getByText('Rep Pahlawan').first().boundingBox())?.y ?? 0;
    const yAndal = (await page.getByText('Rep Andal').first().boundingBox())?.y ?? 0;
    const yKontributor = (await page.getByText('Rep Kontributor').first().boundingBox())?.y ?? 0;
    expect(yPahlawan).toBeLessThan(yAndal);
    expect(yAndal).toBeLessThan(yKontributor);
    // 11. Medali untuk peringkat 1-3.
    expect(await page.locator('.lucide-medal').count()).toBeGreaterThanOrEqual(3);
    // 12. Baris pengguna ditandai "(Anda)". (bukti akhir terlihat)
    await expect(page.getByText('(Anda)')).toBeVisible();
  });

  // ===================== NEGATIVE / EXCEPTION =====================

  test('N1 (TC-37): akses /profile tanpa login → tidak ada badge reputasi, diminta Masuk', async ({ page }) => {
    // 1. Tanpa login, langsung buka /profile.
    await page.goto('/profile');
    // 2. Tidak ada satu pun lencana tier reputasi.
    await expect(page.getByText(/Pahlawan Banjir|Andal|Kontributor|Pemula/)).toHaveCount(0);
    // 3. Ada ajakan "Masuk". (bukti akhir terlihat)
    await expect(page.getByText(/Masuk untuk Melihat Profil|Masuk/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('N2 (TC-55): boundary tier — skor 9 tetap "Pemula", "Kontributor" tidak muncul', async ({ page }) => {
    // 1-6. Login akun skor 9 (mepet ambang Kontributor=10).
    await loginAs(page, 'rep.pemula@fs.id');
    // 7. Buka profil.
    await page.goto('/profile');
    // 8. Lencana tier "Pemula" tampil.
    await expect(page.getByText('Pemula').first()).toBeVisible({ timeout: 15_000 });
    // 9. "Kontributor" TIDAK muncul (skor 9 belum mencapai 10; teks progress tak menyebut nama tier).
    await expect(page.getByText('Kontributor')).toHaveCount(0);
    // 10. Progress hampir penuh: "1 poin lagi menuju tier berikutnya". (bukti akhir terlihat)
    await expect(page.getByText(/1 poin lagi menuju tier berikutnya/i)).toBeVisible();
  });

  test('N3 (TC-56): skor negatif (-3) di-clamp → tetap "Pemula", halaman tidak error', async ({ page }) => {
    // 1-6. Login akun skor -3 (banyak laporan ditolak).
    await loginAs(page, 'rep.minus@fs.id');
    // 7. Buka profil.
    await page.goto('/profile');
    // 8. Bagian reputasi tetap ter-render (tidak crash/NaN).
    await expect(page.getByText('Reputasi').first()).toBeVisible({ timeout: 15_000 });
    // 9. Tier "Pemula" tampil (skor negatif di-clamp ke 0). (bukti akhir terlihat)
    await expect(page.getByText('Pemula').first()).toBeVisible();
  });

  test('N4 (TC-57): papan peringkat saat data kosong/gagal → "Belum ada kontributor", tidak crash', async ({ page }) => {
    // 1-6. Login pengguna mana pun.
    await loginAs(page, 'rep.pemula@fs.id');
    // 2. Simulasikan data kontributor gagal/kosong (intercept query daftar leaderboard → []).
    await page.route(
      (u) => u.href.includes('/rest/v1/profiles') && u.href.includes('order=reputation_score'),
      (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    // 7. Buka papan peringkat.
    await page.goto('/leaderboard');
    // 8. Empty-state tampil, aplikasi tidak crash (heading tetap ada). (bukti akhir terlihat)
    await expect(page.getByText('Belum ada kontributor')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Papan Peringkat/i })).toBeVisible();
  });
});
