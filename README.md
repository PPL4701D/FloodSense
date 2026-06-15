# 🌊 FloodSense

> Aplikasi **pelaporan banjir berbasis crowdsourcing** dengan **peta interaktif nasional + heatmap real-time**. Warga melaporkan banjir (GPS, foto, ketinggian air, tingkat keparahan), laporan diverifikasi staf pemerintah, dan peta menampilkan sebaran serta status wilayah secara real-time.

**Mata Kuliah:** Pengembangan Perangkat Lunak (PPL) · SI-4701-D · Telkom University
**Metodologi:** Scrum (sprint-based)

🔗 **Live Demo:** https://floodsense-indonesia.vercel.app/

---

## ✨ Fitur Utama

| Domain | Fitur |
|--------|-------|
| **Pelaporan** | Form wizard 4-langkah (lokasi GPS, foto, ketinggian, keparahan), riwayat & manajemen laporan pribadi |
| **Peta** | Peta interaktif Leaflet + heatmap real-time, clustering, filter severity/status/waktu, legenda, pencarian lokasi (Nominatim), time-lapse historis |
| **Verifikasi** | Antrian verifikasi staf, voting kredibilitas warga, deteksi spam & duplikat (PostGIS), antrian pemeriksaan ulang terjadwal |
| **Dashboard** | KPI, grafik tren, perbandingan antar wilayah (Recharts), filter wilayah berjenjang, ekspor CSV/PDF |
| **Notifikasi** | Push notification PWA (VAPID), email alert staf (Resend), broadcast TLM, NotificationBell global, preferensi & jam tenang |
| **Sosial** | Komentar & diskusi laporan, reputasi + lencana + papan peringkat, bagikan laporan (Web Share + OG image) |
| **Admin** | Manajemen pengguna & role, manajemen wilayah (Region CRUD + boundary PostGIS), audit log aktivitas |
| **PWA** | Installable (manifest + service worker), offline shell |

---

## 🧱 Tech Stack

- **Framework:** Next.js 16 (App Router) · React 19 · TypeScript
- **Backend/DB:** Supabase — PostgreSQL 17 + PostGIS, Auth, Storage, Realtime, Row-Level Security
- **Peta:** React-Leaflet 5 · OSM tiles · `leaflet.heat` · `react-leaflet-cluster` · Nominatim
- **State / Form:** Zustand · React Hook Form + Zod
- **Charts / Export:** Recharts · jsPDF + jspdf-autotable + html2canvas
- **Notifikasi:** web-push (VAPID) · Resend (email)
- **Testing:** Playwright (E2E)

---

## 👥 Peran Pengguna (RBAC)

| Role | Akses |
|------|-------|
| `warga` | Publik/pelapor — buat laporan, vote, komentar, lihat peta |
| `staf` | Verifikasi laporan, antrian moderasi & recheck |
| `tlm` | Dashboard analitik + broadcast peringatan wilayah |
| `admin` | Akses penuh — kelola pengguna, wilayah, audit log |

---

## 🔑 Akun Uji (Testing)

> Semua akun memakai password yang sama: **`123456`**

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@fs.id` | `123456` |
| TLM | `tlm@fs.id` | `123456` |
| Staf | `staf@fs.id` | `123456` |
| Warga | `warga@fs.id` | `123456` |

---

## 🚀 Menjalankan Secara Lokal

### Prasyarat
- Node.js 18+ dan npm
- Akun/Project Supabase (PostgreSQL + PostGIS)

### Langkah
```bash
# 1. Clone & masuk folder
git clone https://github.com/PPL4701D/FloodSense.git
cd FloodSense

# 2. Install dependency
npm install

# 3. Siapkan environment variables (lihat tabel di bawah)
cp .env.example .env.local   # lalu isi nilainya

# 4. Jalankan dev server
npm run dev
# buka http://localhost:3000
```

### Environment Variables (`.env.local`)

| Variable | Keterangan |
|----------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side) |
| `NEXT_PUBLIC_SITE_URL` | Base URL aplikasi (mis. `http://localhost:3000`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key (Web Push) |
| `VAPID_PRIVATE_KEY` | VAPID private key (Web Push) |
| `VAPID_SUBJECT` | `mailto:...` untuk VAPID |
| `RESEND_API_KEY` | API key Resend (email alert) |
| `RESEND_FROM` | Alamat pengirim email |

---

## 🗄️ Database

Skema & migrasi ada di `supabase/migrations/`:
- `full_schema.sql` — skema penuh (tabel, view, fungsi, RLS, enum)
- `seed_regions.sql` — data wilayah (provinsi → kabupaten/kota → kecamatan)
- Migrasi fitur Sprint 2 (komentar, preferensi notifikasi, RPC wilayah, deteksi duplikat PostGIS, materialized view cluster, dll.)

**Highlight:** RLS aktif di semua tabel · PostGIS untuk geospasial (jarak, cluster, boundary) · Realtime untuk peta & notifikasi · Trigger otomatis (buat profil, hitung skor kredibilitas/reputasi).

Konfigurasi Supabase manual (jika DB fresh): trigger `on_auth_user_created → handle_new_user()`, backfill profil user lama, dan storage bucket `flood-photos` (public + policy upload-own).

---

## 🧪 Testing (E2E — Playwright)

```bash
npm run test:e2e            # semua test
npm run test:e2e:ui        # mode UI interaktif
npm run test:e2e:headed    # lihat browser jalan
npm run test:e2e:s2        # hanya Sprint 2
npm run test:e2e:report    # buka laporan HTML

# per PBI:
npx playwright test pbi-22
npx playwright test pbi-22 --ui

# headed + slow motion (delay antar-aksi, ms):
SLOWMO=800 npx playwright test pbi-22 --headed
```
Dev server otomatis dijalankan oleh konfigurasi Playwright (tak perlu `npm run dev` terpisah). Test memakai akun uji di atas.

---

## 📁 Struktur Proyek (ringkas)

```
src/
├── app/            # App Router — halaman (peta, reports, dashboard, admin, staff, settings) + API routes
├── components/     # layout, map, reports, reputation, notifications, pwa, ui
├── lib/            # hooks, supabase client/server/admin, validators, geo, push, email, utils
├── stores/         # Zustand (mapStore)
└── types/          # tipe database
supabase/migrations/  # skema + seed + migrasi fitur
e2e/                  # test Playwright (per PBI) + helpers
```

---

## 👨‍💻 Tim Pengembang

| Nama | GitHub |
|------|--------|
| Andrarieza Rizqi Pradana | [@ezaarp](https://github.com/ezaarp) |
| Adnan Rizki | [@Adnan0908](https://github.com/Adnan0908) |
| Valerina | [@valerinass](https://github.com/valerinass) |
| Arjuna Dwi Putra Kunaefi | [@arjunadwipk](https://github.com/arjunadwipk) |
| Raihan Ardhana | [@Ardhaneee](https://github.com/Ardhaneee) |
| Ihsan / Andi | [@S4nn-Tuyy](https://github.com/S4nn-Tuyy) |
| Viki Firmansyah | [@Vikstee](https://github.com/Vikstee) |

---

## 📄 Lisensi

Proyek akademik untuk mata kuliah PPL — Telkom University. Penggunaan di luar konteks pembelajaran harap menghubungi tim.
