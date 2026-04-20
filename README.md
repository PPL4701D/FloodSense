# FloodSense Indonesia — Base Project

> PPL SI4701-D · Next.js 14 + Supabase + Tailwind CSS

## Stack

- **Framework:** Next.js 16 (App Router)
- **Database/Auth:** Supabase
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui (install per-component as needed)
- **Form Validation:** React Hook Form + Zod
- **State:** Zustand
- **Map:** React Leaflet

## Setup

### 1. Clone & install dependencies

```bash
git clone <repo-url>
cd floodsense-app-ppl
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
# Isi nilai dari Supabase project dashboard
```

### 3. Setup shadcn/ui

```bash
npx shadcn@latest init
# Pilih: TypeScript, App Router, Tailwind CSS
# Lalu tambah komponen sesuai kebutuhan:
npx shadcn@latest add button input label card
```

### 4. Jalankan dev server

```bash
npm run dev
```

## Struktur Folder

```
src/
├── app/                  # Next.js App Router pages
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Halaman utama (placeholder)
│   └── auth/callback/    # OAuth callback handler
├── components/
│   └── ui/               # Komponen UI (tambah via shadcn/ui)
├── lib/
│   └── supabase/
│       ├── client.ts     # Browser client
│       ├── server.ts     # Server client (RSC / Route Handlers)
│       ├── middleware.ts  # Session refresh middleware
│       └── admin.ts      # Service role client (server-only)
├── middleware.ts          # Auth route protection
└── types/
    └── database.ts       # Generated Supabase types
```

## Database

Migrasi ada di `supabase/migrations/`. Jalankan via Supabase dashboard atau CLI:

```bash
npx supabase db push
```

## Git Workflow

Setiap FR dikerjakan di branch tersendiri:

```bash
git checkout dev_<nama>
git pull origin dev_<nama>
git checkout -b feat/FR-XXX-slug
# kerjakan implementasi
git add .
git commit -m "feat(FR-XXX): deskripsi singkat"
git push origin feat/FR-XXX-slug
# buat Pull Request ke dev_<nama>
```
