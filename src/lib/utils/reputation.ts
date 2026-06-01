/**
 * FR-051 — Reputation tier helper
 *
 * Memetakan reputation_score (profiles.reputation_score) menjadi tier lencana.
 * Skor bertambah +1 saat laporan terverifikasi, −1 saat ditolak (lihat
 * api/verification/route.ts).
 */

export interface BadgeTier {
  key: 'pemula' | 'kontributor' | 'andal' | 'pahlawan';
  label: string;
  color: string;
  min: number;
  /** Skor minimum tier berikutnya, null jika tier tertinggi */
  next: number | null;
}

const TIERS: BadgeTier[] = [
  { key: 'pemula', label: 'Pemula', color: '#94a3b8', min: 0, next: 10 },
  { key: 'kontributor', label: 'Kontributor', color: '#0891b2', min: 10, next: 50 },
  { key: 'andal', label: 'Andal', color: '#7c3aed', min: 50, next: 100 },
  { key: 'pahlawan', label: 'Pahlawan Banjir', color: '#f59e0b', min: 100, next: null },
];

export function getBadgeTier(score: number): BadgeTier {
  const s = Math.max(0, score);
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (s >= t.min) tier = t;
  }
  return tier;
}

/** Progress 0..1 menuju tier berikutnya (1 jika sudah tier tertinggi). */
export function tierProgress(score: number): number {
  const tier = getBadgeTier(score);
  if (tier.next === null) return 1;
  const span = tier.next - tier.min;
  return Math.min(1, Math.max(0, (Math.max(0, score) - tier.min) / span));
}
