'use client';

/**
 * FR-023 + FR-024 — Dashboard dengan Filter Wilayah & Waktu
 *
 * Halaman /dashboard (staf/tlm/admin). Menyediakan CascadingRegionFilter +
 * DateRangePicker, sinkron ke URL query params, lalu menampilkan ringkasan
 * laporan terfilter. Grafik/KPI lanjutan menyusul di PBI-12 (mengonsumsi state
 * filter yang sama).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import WaveLoader from '@/components/ui/WaveLoader';
import RegionFilter from '@/components/dashboard/RegionFilter';
import TimeRangeFilter, { type TimeRange } from '@/components/dashboard/TimeRangeFilter';
import { LayoutDashboard, FileText, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import type { ReportStatus, SeverityLevel } from '@/types/database';

interface Row { status: ReportStatus; severity: SeverityLevel }

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [regionId, setRegionId] = useState<string | null>(null);
  const [range, setRange] = useState<TimeRange>({ preset: '7d', from: daysAgoISO(7), to: new Date().toISOString().slice(0, 10) });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const hydrated = useRef(false);

  // Guard: staf/tlm/admin
  useEffect(() => {
    if (!authLoading && !(role && ['staf', 'tlm', 'admin'].includes(role))) router.replace('/');
  }, [authLoading, role, router]);

  // Hydrate dari URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('region')) setRegionId(p.get('region'));
    if (p.get('from') && p.get('to')) setRange({ preset: 'custom', from: p.get('from')!, to: p.get('to')! });
    hydrated.current = true;
  }, []);

  // Sync ke URL
  useEffect(() => {
    if (!hydrated.current) return;
    const p = new URLSearchParams();
    if (regionId) p.set('region', regionId);
    p.set('from', range.from); p.set('to', range.to);
    window.history.replaceState(null, '', `?${p.toString()}`);
  }, [regionId, range]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('reports')
      .select('status, severity')
      .gte('created_at', new Date(range.from + 'T00:00:00').toISOString())
      .lte('created_at', new Date(range.to + 'T23:59:59').toISOString());
    if (regionId) q = q.eq('region_id', regionId);
    const { data } = await q;
    setRows((data as Row[] | null) ?? []);
    setLoading(false);
  }, [supabase, regionId, range.from, range.to]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const total = rows.length;
  const aktif = rows.filter((r) => r.status === 'pending' || r.status === 'dalam_peninjauan').length;
  const selesai = rows.filter((r) => r.status === 'verified').length;
  const kritis = rows.filter((r) => r.severity === 'sangat_berat').length;

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><WaveLoader size={48} /></div>;
  }

  const kpi = [
    { label: 'Total Laporan', value: total, icon: FileText, color: 'var(--primary-400)' },
    { label: 'Aktif', value: aktif, icon: Clock, color: '#eab308' },
    { label: 'Terverifikasi', value: selesai, icon: CheckCircle2, color: '#22c55e' },
    { label: 'Kritis', value: kritis, icon: AlertTriangle, color: '#ef4444' },
  ];

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto', paddingBottom: '88px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <LayoutDashboard size={20} color="var(--primary-400)" />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dashboard</h1>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Wilayah</p>
          <RegionFilter value={regionId} onChange={setRegionId} />
        </div>
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>Rentang Waktu</p>
          <TimeRangeFilter value={range} onChange={setRange} />
        </div>
      </div>

      {/* KPI summary */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><WaveLoader size={40} /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {kpi.map((k) => (
            <div key={k.label} className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <k.icon size={16} color={k.color} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{k.label}</span>
              </div>
              <p style={{ fontSize: '1.75rem', fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && total === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '1.5rem' }}>
          Tidak ada laporan pada filter ini.
        </p>
      )}

      <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1.5rem', textAlign: 'center' }}>
        Grafik tren & perbandingan wilayah menyusul (PBI-12).
      </p>
    </div>
  );
}
