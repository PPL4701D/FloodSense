/**
 * FR-056 (PBI-31) — OG Image Dinamis per Laporan
 *
 * Membuat gambar preview (1200×630) saat tautan laporan dibagikan ke
 * media sosial/chat: menampilkan tingkat keparahan, lokasi, ketinggian air,
 * dan status, dengan branding FloodSense. Data diambil publik via Supabase REST.
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Laporan Banjir FloodSense';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SEV: Record<string, { label: string; color: string }> = {
  ringan: { label: 'Ringan', color: '#22c55e' },
  sedang: { label: 'Sedang', color: '#eab308' },
  berat: { label: 'Berat', color: '#f97316' },
  sangat_berat: { label: 'Sangat Berat', color: '#ef4444' },
};
const STATUS: Record<string, string> = {
  pending: 'Menunggu Verifikasi', verified: 'Terverifikasi', rejected: 'Ditolak',
  flagged: 'Ditandai', dalam_peninjauan: 'Dalam Peninjauan', moderated: 'Dimoderasi',
};

interface Row { severity: string; description: string | null; address: string | null; water_height_cm: number | null; status: string }

async function getReport(id: string): Promise<Row | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!base || !key) return null;
    const res = await fetch(
      `${base}/rest/v1/reports?id=eq.${id}&select=severity,description,address,water_height_cm,status&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Row[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  const sev = report ? SEV[report.severity] ?? SEV.sedang : SEV.sedang;
  const title = report ? `Banjir ${sev.label}` : 'Laporan Banjir';
  const location = report?.address || 'Lokasi tidak diketahui';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: '70px', color: 'white', fontFamily: 'sans-serif', position: 'relative',
        }}
      >
        {/* Accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '12px', background: sev.color }} />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
            🌊
          </div>
          <div style={{ fontSize: '34px', fontWeight: 800 }}>FloodSense</div>
        </div>

        {/* Severity badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div style={{ background: sev.color, color: '#0f172a', fontSize: '26px', fontWeight: 800, padding: '8px 24px', borderRadius: '999px', display: 'flex' }}>
            {sev.label.toUpperCase()}
          </div>
          {report && (
            <div style={{ fontSize: '24px', color: '#94a3b8', display: 'flex' }}>{STATUS[report.status] ?? report.status}</div>
          )}
        </div>

        {/* Title */}
        <div style={{ fontSize: '64px', fontWeight: 800, lineHeight: 1.1, marginBottom: '20px', display: 'flex' }}>{title}</div>

        {/* Location */}
        <div style={{ fontSize: '32px', color: '#cbd5e1', display: 'flex', maxWidth: '1000px' }}>📍 {location}</div>

        {/* Footer info */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '40px', fontSize: '26px', color: '#94a3b8' }}>
          {report?.water_height_cm != null && <div style={{ display: 'flex' }}>💧 Ketinggian: {report.water_height_cm} cm</div>}
          <div style={{ display: 'flex' }}>Pelaporan banjir crowdsourcing nasional</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
