'use client';

/**
 * FR-050 (PBI-26) — Antrian Pemeriksaan Ulang Terjadwal
 *
 * Halaman /staff/recheck (staf/tlm/admin). Menampilkan laporan berstatus
 * "dalam_peninjauan" yang dijadwalkan diperiksa ulang (verifications.scheduled_check_at),
 * diurut paling mendesak di atas. Item yang lewat jadwal ditandai "Terlambat".
 * Klik item → buka detail laporan untuk diputuskan (verified/rejected).
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import WaveLoader from '@/components/ui/WaveLoader';
import { CalendarClock, ChevronLeft, AlertTriangle, Droplets, ChevronRight, Clock } from 'lucide-react';
import type { SeverityLevel } from '@/types/database';
import { SEVERITY_LABELS } from '@/types/database';

interface RecheckItem {
  id: string;
  scheduled_check_at: string;
  notes: string;
  reports: {
    id: string;
    description: string | null;
    severity: SeverityLevel;
    status: string;
    address: string | null;
  } | null;
}

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  ringan: '#22c55e', sedang: '#eab308', berat: '#f97316', sangat_berat: '#ef4444',
};

function relTime(iso: string): { label: string; overdue: boolean } {
  const diff = new Date(iso).getTime() - Date.now();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const d = Math.floor(h / 24);
  const txt = d > 0 ? `${d} hari` : h > 0 ? `${h} jam` : `${Math.floor(abs / 60000)} mnt`;
  return { label: overdue ? `Terlambat ${txt}` : `dalam ${txt}`, overdue };
}

export default function RecheckQueuePage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [items, setItems] = useState<RecheckItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !(role && ['staf', 'tlm', 'admin'].includes(role))) router.replace('/');
  }, [authLoading, role, router]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('verifications')
      .select('id, scheduled_check_at, notes, reports!inner(id, description, severity, status, address)')
      .not('scheduled_check_at', 'is', null)
      .eq('reports.status', 'dalam_peninjauan')
      .order('scheduled_check_at', { ascending: true });
    // Dedup: hanya jadwal terbaru per laporan
    const seen = new Set<string>();
    const rows = (data as unknown as RecheckItem[] | null) ?? [];
    const unique = rows.filter((r) => {
      const rid = r.reports?.id;
      if (!rid || seen.has(rid)) return false;
      seen.add(rid);
      return true;
    });
    setItems(unique);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { if (role && ['staf', 'tlm', 'admin'].includes(role)) fetchQueue(); }, [role, fetchQueue]);

  const overdueCount = items.filter((i) => new Date(i.scheduled_check_at) < new Date()).length;

  if (authLoading || (loading && items.length === 0)) {
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
            <CalendarClock size={18} color="var(--primary-400)" />
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Pemeriksaan Ulang Terjadwal</h1>
          </div>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' }}>
            {items.length} laporan dijadwalkan{overdueCount > 0 && <> · <span style={{ color: '#ef4444', fontWeight: 600 }}>{overdueCount} terlambat</span></>}
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <CalendarClock size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Tidak ada laporan terjadwal untuk diperiksa ulang.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((it) => {
            const rep = it.reports!;
            const rt = relTime(it.scheduled_check_at);
            const sevColor = SEVERITY_COLORS[rep.severity];
            return (
              <Link key={it.id} href={`/report/${rep.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="card" style={{ padding: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', borderLeft: `3px solid ${rt.overdue ? '#ef4444' : sevColor}` }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: 'var(--radius-md)', background: `${sevColor}1f`, border: `1px solid ${sevColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Droplets size={17} color={sevColor} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: sevColor }}>{SEVERITY_LABELS[rep.severity]}</span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.5625rem', fontWeight: 700,
                        color: rt.overdue ? '#ef4444' : 'var(--text-muted)',
                        background: rt.overdue ? 'rgba(239,68,68,0.12)' : 'var(--bg-elevated)',
                        padding: '1px 6px', borderRadius: '999px',
                      }}>
                        {rt.overdue ? <AlertTriangle size={9} /> : <Clock size={9} />} {rt.label}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 500, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rep.description || rep.address || 'Laporan banjir'}
                    </p>
                    <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: '1px 0 0' }}>
                      Jadwal: {new Date(it.scheduled_check_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
