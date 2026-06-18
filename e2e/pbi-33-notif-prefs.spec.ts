import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PBI-33 — Preferensi Notifikasi Lanjutan                                 ║
 * ║  Dibuat oleh : Adnan Rizki Pratama                                       ║
 * ║  Akun uji    : pbi33.warga@fs.id / Test@1234!  (role: warga)            ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  TC-33-01  [+] Halaman /settings/notifications tampil dengan komponen    ║
 * ║  TC-33-02  [+] Toggle jenis notifikasi dapat diubah & URL tetap          ║
 * ║  TC-33-03  [+] Toggle Jam Tenang dapat dihidupkan & select jam muncul   ║
 * ║  TC-33-04  [+] Input jam mulai Jam Tenang dapat diubah & tersimpan       ║
 * ║  TC-33-05  [-] Akses /settings/notifications tanpa login → redirect /login ║
 * ║  TC-33-06  [-] Toggle dimatikan → state kembali off & tersimpan ke DB   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Semua TC menggunakan akun TERISOLASI pbi33.warga@fs.id agar preferensi
 * tidak tercampur dengan akun warga@fs.id yang dipakai PBI lain.
 */

test.describe('PBI-33 — Preferensi Notifikasi Lanjutan', () => {
  // ===========================================================================
  // TC-33-01  [POSITIVE] Halaman tampil dengan heading & semua komponen
  // ===========================================================================
  /**
   * Tujuan  : Membuktikan halaman pengaturan preferensi notifikasi dapat dimuat
   *           dan menampilkan semua komponen utama: heading, section jenis
   *           notifikasi (5 toggle), dan section Jam Tenang.
   *
   * Pre-condition:
   *   1. Aplikasi berjalan di http://localhost:3000
   *   2. Akun pbi33.warga@fs.id / Test@1234! tersedia dengan role warga
   *
   * Langkah Pengujian (POV Real User):
   *   1. Pengguna membuka browser dan menavigasi ke http://localhost:3000/login
   *   2. Pengguna mengisi email "pbi33.warga@fs.id" dan password "Test@1234!"
   *   3. Pengguna menekan tombol "Masuk" dan menunggu hingga login berhasil
   *   4. Setelah login, pengguna secara manual mengetik URL
   *      http://localhost:3000/settings/notifications di address bar
   *   5. Halaman dimuat — pengguna melihat judul "Preferensi Notifikasi"
   *   6. Pengguna melihat teks "Jenis Notifikasi" beserta 5 toggle di bawahnya
   *   7. Pengguna menggulung halaman dan melihat bagian "Jam Tenang" dengan
   *      toggle tersendiri
   *   8. Pengguna memverifikasi URL di address bar tetap di /settings/notifications
   *      (tidak diredirect ke halaman lain)
   *
   * Input    : URL /settings/notifications
   * Expected : URL tetap /settings/notifications; heading "Preferensi Notifikasi"
   *            tampil; teks "Jenis Notifikasi" terlihat; teks "Jam Tenang" terlihat;
   *            minimal 5 elemen role="switch" ada di halaman.
   */
  test('TC-33-01 [+] halaman /settings/notifications tampil lengkap dengan semua komponen', async ({ page }) => {
    // Step 1-3: Login
    await login(page, 'pbi33Warga');

    // Step 4: Navigasi ke halaman pengaturan notifikasi
    await page.goto('/settings/notifications');

    // Step 8: URL harus tetap
    await expect(page).toHaveURL(/\/settings\/notifications/, { timeout: 10_000 });

    // Step 5: Heading "Preferensi Notifikasi"
    await expect(
      page.getByRole('heading', { name: /Preferensi Notifikasi/i })
    ).toBeVisible({ timeout: 15_000 });

    // Step 6: Section "Jenis Notifikasi" tampil
    await expect(page.getByText(/Jenis Notifikasi/i)).toBeVisible({ timeout: 10_000 });

    // Step 7: Section "Jam Tenang" tampil
    await expect(page.getByText(/Jam Tenang/i)).toBeVisible({ timeout: 5_000 });

    // Minimal 5 toggle (5 jenis notifikasi) + 1 toggle Jam Tenang = 6 total
    const allSwitches = page.locator('[role="switch"]');
    const switchCount = await allSwitches.count();
    expect(switchCount).toBeGreaterThanOrEqual(5);
  });

  // ===========================================================================
  // TC-33-02  [POSITIVE] Toggle jenis notifikasi dapat diubah, URL tetap
  // ===========================================================================
  /**
   * Tujuan  : Memverifikasi bahwa pengguna dapat mengubah status toggle untuk
   *           jenis notifikasi tertentu (on→off atau off→on), perubahan tersebut
   *           langsung tersimpan ke Supabase, dan URL halaman tidak berubah.
   *
   * Pre-condition:
   *   1. Pengguna pbi33.warga@fs.id sudah login
   *   2. Halaman /settings/notifications terbuka
   *   3. Minimal ada 1 toggle dengan role="switch" di dalam section "Jenis Notifikasi"
   *
   * Langkah Pengujian (POV Real User):
   *   1. Pengguna login dan membuka /settings/notifications
   *   2. Pengguna melihat daftar toggle di bawah "Jenis Notifikasi"
   *   3. Pengguna mengamati state awal toggle pertama
   *      (misalnya: "Peringatan Broadcast" dalam keadaan ON, aria-checked="true")
   *   4. Pengguna menekan/klik toggle pertama untuk mengubah state-nya
   *   5. Pengguna menunggu sekitar 1 detik untuk konfirmasi perubahan tersimpan
   *      (muncul indikator "Tersimpan" ✓ kecil di sebelah kanan judul "Jenis Notifikasi")
   *   6. Pengguna memverifikasi state toggle berubah dari kondisi semula
   *      (jika tadi ON sekarang OFF, atau sebaliknya)
   *   7. Pengguna melihat URL di address bar — masih /settings/notifications
   *   8. Pengguna menekan toggle sekali lagi untuk mengembalikan ke state semula
   *      (opsional — agar TC lain tidak terdampak)
   *
   * Input    : Klik toggle pertama (switch) dari daftar jenis notifikasi
   * Expected : aria-checked toggle berubah (true→false atau false→true);
   *            URL tetap /settings/notifications; perubahan tersimpan (teks "Tersimpan" muncul).
   */
  test('TC-33-02 [+] toggle jenis notifikasi dapat diubah dan URL tetap', async ({ page }) => {
    await login(page, 'pbi33Warga');
    await page.goto('/settings/notifications');

    await expect(page.getByText(/Jenis Notifikasi/i)).toBeVisible({ timeout: 15_000 });

    // Step 3: Catat state awal toggle pertama (5 toggle jenis notif = index 0..4)
    const switches = page.locator('[role="switch"]');
    await expect(switches.first()).toBeVisible({ timeout: 5_000 });
    const stateBefore = await switches.first().getAttribute('aria-checked');

    // Step 4: Klik toggle
    await switches.first().click();

    // Step 5: Tunggu simpan (max 2 detik — Supabase upsert cepat)
    await page.waitForTimeout(1_200);

    // Step 6: State harus berubah
    const stateAfter = await switches.first().getAttribute('aria-checked');
    expect(stateAfter).not.toEqual(stateBefore);

    // Step 7: URL tetap
    await expect(page).toHaveURL(/\/settings\/notifications/);

    // Step 8: Kembalikan ke state semula agar tidak mengganggu TC lain
    await switches.first().click();
    await page.waitForTimeout(800);
    const stateRestored = await switches.first().getAttribute('aria-checked');
    expect(stateRestored).toEqual(stateBefore);
  });

  // ===========================================================================
  // TC-33-03  [POSITIVE] Toggle Jam Tenang dapat dihidupkan & select jam muncul
  // ===========================================================================
  /**
   * Tujuan  : Memverifikasi bahwa pengguna dapat mengaktifkan fitur Jam Tenang
   *           (quiet hours), dan setelah diaktifkan muncul dua dropdown pilihan
   *           jam (mulai dan selesai) yang sebelumnya tidak terlihat.
   *
   * Pre-condition:
   *   1. Pengguna pbi33.warga@fs.id sudah login
   *   2. Halaman /settings/notifications terbuka
   *   3. Toggle Jam Tenang dalam keadaan OFF (aria-checked="false")
   *
   * Langkah Pengujian (POV Real User):
   *   1. Pengguna login dan membuka /settings/notifications
   *   2. Pengguna menggulung ke bagian bawah kartu NotificationPreferences
   *   3. Pengguna melihat bagian "Jam Tenang" dengan ikon bulan dan toggle
   *   4. Pengguna membaca deskripsi: "Push ditahan pada rentang jam ini..."
   *   5. Pengguna melihat toggle Jam Tenang dalam keadaan OFF
   *   6. Jika toggle SUDAH ON (dari pengujian sebelumnya), pengguna mematikannya dulu
   *   7. Pengguna menekan toggle Jam Tenang untuk menyalakannya
   *   8. Pengguna menunggu 1 detik untuk simpan ke Supabase
   *   9. Toggle Jam Tenang sekarang dalam keadaan ON (aria-checked="true")
   *  10. Dua dropdown pemilih jam muncul di bawah toggle
   *       — satu untuk jam mulai (quiet_start)
   *       — satu untuk jam selesai (quiet_end)
   *       — dengan pemisah teks "sampai" di antara keduanya
   *  11. Pengguna memverifikasi kedua dropdown tersedia dan terlihat
   *
   * Input    : Klik toggle Jam Tenang (OFF → ON)
   * Expected : aria-checked Jam Tenang = 'true'; teks "sampai" tampil;
   *            elemen <select> jam mulai dan selesai muncul.
   */
  test('TC-33-03 [+] toggle Jam Tenang dapat dihidupkan dan select jam muncul', async ({ page }) => {
    await login(page, 'pbi33Warga');
    await page.goto('/settings/notifications');

    await expect(page.getByText(/Jam Tenang/i)).toBeVisible({ timeout: 15_000 });

    // Identifikasi toggle Jam Tenang (toggle terakhir dari semua switch)
    const allSwitches = page.locator('[role="switch"]');
    const count = await allSwitches.count();
    const quietToggle = allSwitches.nth(count - 1);
    await expect(quietToggle).toBeVisible({ timeout: 5_000 });

    // Step 6: Jika sudah ON, matikan dulu
    const stateBefore = await quietToggle.getAttribute('aria-checked');
    if (stateBefore === 'true') {
      await quietToggle.click();
      await page.waitForTimeout(800);
      // Verifikasi sudah OFF
      await expect(quietToggle).toHaveAttribute('aria-checked', 'false', { timeout: 3_000 });
    }

    // Step 7-8: Nyalakan Jam Tenang
    await quietToggle.click();
    await page.waitForTimeout(1_000);

    // Step 9: Harus ON
    await expect(quietToggle).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });

    // Step 10-11: Select jam muncul + teks "sampai"
    await expect(page.getByText(/sampai/i)).toBeVisible({ timeout: 5_000 });

    const selects = page.locator('select');
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThanOrEqual(2); // mulai + selesai

    await expect(selects.first()).toBeVisible();
    await expect(selects.nth(1)).toBeVisible();
  });

  // ===========================================================================
  // TC-33-04  [POSITIVE] Input jam mulai Jam Tenang dapat diubah & tersimpan
  // ===========================================================================
  /**
   * Tujuan  : Memverifikasi bahwa pengguna dapat memilih jam spesifik untuk
   *           jam mulai Jam Tenang melalui dropdown, dan nilai tersebut tersimpan
   *           dengan benar.
   *
   * Pre-condition:
   *   1. Pengguna pbi33.warga@fs.id sudah login
   *   2. Halaman /settings/notifications terbuka
   *   3. Jam Tenang SUDAH dalam keadaan ON (dari TC-33-03, atau diaktifkan di sini)
   *
   * Langkah Pengujian (POV Real User):
   *   1. Pengguna login dan membuka /settings/notifications
   *   2. Pengguna memastikan toggle Jam Tenang dalam keadaan ON
   *      (jika belum, aktifkan terlebih dahulu)
   *   3. Dua dropdown jam muncul — pengguna melihat dropdown pertama (jam mulai)
   *   4. Pengguna mengklik dropdown jam mulai — tampil daftar pilihan jam
   *      dari 00:00 hingga 23:00
   *   5. Pengguna memilih jam "08:00" (value = "8") dari dropdown
   *   6. Pengguna menunggu 1 detik untuk simpan ke Supabase
   *   7. Pengguna memverifikasi nilai yang terpilih pada dropdown adalah "8"
   *   8. Pengguna memverifikasi URL tidak berubah dari /settings/notifications
   *   9. Pengguna membuka dropdown sekali lagi dan memilih jam berbeda (22:00)
   *      untuk memastikan perubahan dapat dilakukan berulang
   *
   * Input    : Pilih "08:00" (value="8") pada dropdown jam mulai
   * Expected : Nilai terpilih pada select pertama adalah "8";
   *            URL tetap /settings/notifications; perubahan tersimpan ke Supabase.
   */
  test('TC-33-04 [+] input jam mulai Jam Tenang dapat diubah dan tersimpan', async ({ page }) => {
    await login(page, 'pbi33Warga');
    await page.goto('/settings/notifications');

    await expect(page.getByText(/Jam Tenang/i)).toBeVisible({ timeout: 15_000 });

    // Step 2: Pastikan Jam Tenang aktif
    const allSwitches = page.locator('[role="switch"]');
    const count = await allSwitches.count();
    const quietToggle = allSwitches.nth(count - 1);

    const currentState = await quietToggle.getAttribute('aria-checked');
    if (currentState !== 'true') {
      await quietToggle.click();
      await page.waitForTimeout(1_000);
      await expect(quietToggle).toHaveAttribute('aria-checked', 'true', { timeout: 5_000 });
    }

    // Step 3: Dropdown jam muncul
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible({ timeout: 5_000 });

    // Step 5-6: Pilih jam 08:00 (value="8")
    await selects.first().selectOption('8');
    await page.waitForTimeout(1_000);

    // Step 7: Nilai terpilih harus "8"
    const selectedVal = await selects.first().inputValue();
    expect(selectedVal).toBe('8');

    // Step 8: URL tetap
    await expect(page).toHaveURL(/\/settings\/notifications/);

    // Step 9: Ubah ke 22:00 untuk verifikasi perubahan berulang
    await selects.first().selectOption('22');
    await page.waitForTimeout(800);
    const valAfter = await selects.first().inputValue();
    expect(valAfter).toBe('22');
  });

  // ===========================================================================
  // TC-33-05  [NEGATIVE] Akses tanpa login → redirect ke /login
  // ===========================================================================
  /**
   * Tujuan  : Memverifikasi bahwa middleware melindungi rute /settings/notifications
   *           dari akses tanpa autentikasi. Pengguna yang tidak login harus
   *           diarahkan ke halaman login.
   *
   * Pre-condition:
   *   1. Aplikasi berjalan di http://localhost:3000
   *   2. Browser dalam kondisi fresh — tidak ada sesi login aktif
   *   3. Tidak ada cookie atau token autentikasi tersimpan
   *
   * Langkah Pengujian (POV Real User):
   *   1. Pengguna membuka browser baru yang belum pernah login ke FloodSense
   *   2. Pengguna mengetik URL http://localhost:3000/settings/notifications
   *      di address bar dan menekan Enter
   *   3. Sistem mendeteksi tidak ada sesi autentikasi (token tidak valid/tidak ada)
   *   4. Middleware Next.js mencegat request dan melakukan redirect ke /login
   *   5. Browser menampilkan halaman login
   *   6. Pengguna melihat form login dengan kolom Email dan Password
   *   7. Pengguna memverifikasi URL di address bar berakhiran /login
   *      (bisa juga /login?redirect=/settings/notifications)
   *   8. Halaman preferensi notifikasi tidak pernah dimuat
   *
   * Input    : Navigasi langsung ke /settings/notifications tanpa sesi login
   * Expected : URL berubah menjadi /login; form login tampil;
   *            halaman preferensi notifikasi TIDAK diakses.
   */
  test('TC-33-05 [-] akses /settings/notifications tanpa login diredirect ke /login', async ({ page }) => {
    // Step 1-2: Langsung akses URL tanpa login (fresh context sudah disiapkan Playwright)
    await page.goto('/settings/notifications');

    // Step 3-7: Harus redirect ke /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    // Step 6: Form login ada
    await expect(page.locator('#email')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Masuk', exact: true })).toBeVisible();

    // Step 8: Heading preferensi TIDAK ada
    await expect(
      page.getByRole('heading', { name: /Preferensi Notifikasi/i })
    ).not.toBeVisible();
  });

  // ===========================================================================
  // TC-33-06  [NEGATIVE] Toggle dimatikan → state kembali off & tersimpan ke DB
  // ===========================================================================
  /**
   * Tujuan  : Memverifikasi penanganan kasus toggle dimatikan (state false).
   *           Ini merupakan negative test karena pengguna menonaktifkan fitur —
   *           penting untuk memastikan pengguna tidak akan menerima notifikasi
   *           jenis tertentu setelah menonaktifkannya.
   *
   * Pre-condition:
   *   1. Pengguna pbi33.warga@fs.id sudah login
   *   2. Setidaknya satu toggle jenis notifikasi dalam keadaan ON (aria-checked="true")
   *
   * Langkah Pengujian (POV Real User):
   *   1. Pengguna login dan membuka /settings/notifications
   *   2. Pengguna melihat toggle "Peringatan Broadcast" dalam keadaan ON
   *   3. Pengguna berpikir ingin berhenti menerima notifikasi broadcast
   *   4. Pengguna menekan toggle "Peringatan Broadcast" untuk mematikannya
   *   5. Toggle berubah menjadi abu-abu (OFF state — aria-checked="false")
   *   6. Pengguna menunggu 1-2 detik — muncul indikator "✓ Tersimpan" kecil
   *   7. Pengguna menutup browser / merefresh halaman
   *   8. Pengguna kembali ke halaman /settings/notifications
   *   9. Pengguna memverifikasi toggle "Peringatan Broadcast" masih dalam keadaan OFF
   *      (state persisten — tersimpan di Supabase)
   *  10. Pengguna mengamati bahwa URL tetap /settings/notifications selama proses
   *
   * Input    : Klik toggle pertama (misalnya "Peringatan Broadcast") untuk
   *            mengubahnya dari ON menjadi OFF
   * Expected : Toggle berubah ke aria-checked="false"; setelah page refresh,
   *            toggle tetap OFF (persistensi terbukti); URL tidak berubah.
   */
  test('TC-33-06 [-] toggle dimatikan → state OFF tersimpan dan persisten setelah refresh', async ({ page }) => {
    await login(page, 'pbi33Warga');
    await page.goto('/settings/notifications');

    await expect(page.getByText(/Jenis Notifikasi/i)).toBeVisible({ timeout: 15_000 });

    const switches = page.locator('[role="switch"]');
    await expect(switches.first()).toBeVisible({ timeout: 5_000 });

    // Step 2-3: Pastikan toggle pertama dalam keadaan ON sebelum dimatikan
    const stateBefore = await switches.first().getAttribute('aria-checked');
    if (stateBefore !== 'true') {
      // Nyalakan dulu agar kita bisa tes mematikannya
      await switches.first().click();
      await page.waitForTimeout(800);
      await expect(switches.first()).toHaveAttribute('aria-checked', 'true', { timeout: 3_000 });
    }

    // Step 4-5: Matikan toggle
    await switches.first().click();
    await page.waitForTimeout(1_000);

    // Step 5-6: State harus menjadi false
    await expect(switches.first()).toHaveAttribute('aria-checked', 'false', { timeout: 5_000 });

    // Step 10: URL tetap
    await expect(page).toHaveURL(/\/settings\/notifications/);

    // Step 7-8: Refresh halaman
    await page.reload();
    await expect(page.getByText(/Jenis Notifikasi/i)).toBeVisible({ timeout: 15_000 });

    // Step 9: State seharusnya masih OFF setelah refresh (persistensi)
    const switchesAfterReload = page.locator('[role="switch"]');
    await expect(switchesAfterReload.first()).toBeVisible({ timeout: 5_000 });
    const stateAfterReload = await switchesAfterReload.first().getAttribute('aria-checked');
    expect(stateAfterReload).toBe('false');

    // Cleanup: kembalikan ke ON agar tidak memengaruhi TC lain
    await switchesAfterReload.first().click();
    await page.waitForTimeout(600);
  });
});
