'use client';

/**
 * FR-021 (PBI-10) — Deteksi Duplikasi & Spam (Tinjauan Staf)
 *
 * Halaman /staff/clusters (staf/tlm/admin). Menampilkan kelompok laporan
 * berdekatan (potensi duplikat/spam) dari /api/admin/duplicate-clusters, diurut
 * jumlah laporan terbanyak. Klik laporan → buka detail untuk verifikasi/moderasi.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import WaveLoader from '@/components/ui/WaveLoader';
import { CopyCheck, ChevronLeft, AlertTriangle, MapPin, Loader2, ShieldAlert } from 'lucide-react';
import type { SeverityLevel } from '@/types/database';
import { SEVERITY_LABELS } from '@/types/database';

interface Cluster {
  lat: number; lng: number; report_count: number; latest_at: string;
  sample: string | null; severity: SeverityLevel; report_ids: string[];
}

const SEV_COLOR: Record<SeverityLevel, string> = { ringan: '#22c55e', sedang: '#eab308', berat: '#f97316', sangat_berat: '#ef4444' };

export default function DuplicateClustersPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [scanned, setScanned] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !(role && ['staf', 'tlm', 'admin'].includes(role))) router.replace('/');
  }, [authLoading, role, router]);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/duplicate-clusters');
    const j = await res.json();
    if (res.ok) { setClusters(j.clusters ?? []); setScanned(j.total_reports_scanned ?? 0); }
    setLoading(false);
  }, []);

  useEffect(() => { if (role && ['staf', 'tlm', 'admin'].includes(role)) fetchClusters(); }, [role, fetchClusters]);

  if (authLoading || (loading && clusters.length === 0)) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><WaveLoader size={48} /></div>;
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '720px', margin: '0 auto', paddingBottom: '88px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', color: 'var(--text-primary)' }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} color="var(--primary-400)" />
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Deteksi Duplikat & Spam</h1>
          </div>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' }}>
            {clusters.length} kelompok potensi duplikat · {scanned} laporan dipindai (7 hari)
          </p>
        </div>
        <button onClick={fetchClusters} disabled={loading} className="btn btn-ghost" style={{ fontSize: '0.75rem' }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'Muat Ulang'}
        </button>
      </div>

      <div className="card" style={{ padding: '0.75rem 0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}>
        <AlertTriangle size={16} color="#eab308" />
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
          Kelompok laporan dalam radius ±200&nbsp;m. Tinjau untuk gabung/moderasi jika benar duplikat.
        </p>
      </div>

      {clusters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <CopyCheck size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Tidak ada potensi duplikat terdeteksi. 👍</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {clusters.map((c, i) => {
            const color = SEV_COLOR[c.severity] ?? '#eab308';
            return (
              <div key={i} className="card" style={{ padding: '0.875rem', borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', padding: '2px 8px', borderRadius: '999px' }}>
                    {c.report_count} LAPORAN BERDEKATAN
                  </span>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, color }}>{SEVERITY_LABELS[c.severity]}</span>
                  <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <MapPin size={10} /> {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                  </span>
                </div>
                {c.sample && <p style={{ fontSize: '0.8125rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>{c.sample}</p>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                  {c.report_ids.map((id, idx) => (
                    <Link key={id} href={`/report/${id}`} style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--primary-400)', background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', padding: '3px 9px', borderRadius: '6px', textDecoration: 'none' }}>
                      Laporan #{idx + 1}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
