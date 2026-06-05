'use client';

/**
 * FR-023 + FR-024 — Dashboard dengan Filter Wilayah & Waktu
 * FR-025/026/028 (PBI-12) — Grafik tren, distribusi status/keparahan, perbandingan wilayah.
 * FR-027 (PBI-13) — Ekspor data terfilter ke CSV & PDF.
 *
 * Halaman /dashboard (staf/tlm/admin). CascadingRegionFilter + DateRangePicker
 * sinkron ke URL query params, lalu menampilkan KPI, grafik, dan tombol ekspor
 * untuk laporan terfilter.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import WaveLoader from '@/components/ui/WaveLoader';
import RegionFilter from '@/components/dashboard/RegionFilter';
import TimeRangeFilter, { type TimeRange } from '@/components/dashboard/TimeRangeFilter';
import TrendChart, { type TrendPoint } from '@/components/dashboard/TrendChart';
import { StatusDonut, SeverityBars, type Slice } from '@/components/dashboard/DistributionChart';
import RegionComparison, { type RegionDatum } from '@/components/dashboard/RegionComparison';
import ExportButtons from '@/components/dashboard/ExportButtons';
import type { ExportRow } from '@/lib/utils/exportData';
import { LayoutDashboard, FileText, CheckCircle2, Clock, AlertTriangle, TrendingUp, PieChart, BarChart3 } from 'lucide-react';
import type { ReportStatus, SeverityLevel } from '@/types/database';

interface Row {
  status: ReportStatus;
  severity: SeverityLevel;
  created_at: string;
  region_id: string | null;
  reporter_id: string | null;
  address: string | null;
  water_height_cm: number | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Menunggu', color: '#eab308' },
  dalam_peninjauan: { label: 'Peninjauan', color: '#f97316' },
  verified: { label: 'Terverifikasi', color: '#22c55e' },
  rejected: { label: 'Ditolak', color: '#ef4444' },
  flagged: { label: 'Ditandai', color: '#8b5cf6' },
  moderated: { label: 'Dimoderasi', color: '#64748b' },
};

const SEVERITY_META: Record<string, { label: string; color: string }> = {
  ringan: { label: 'Ringan', color: '#22c55e' },
  sedang: { label: 'Sedang', color: '#eab308' },
  berat: { label: 'Berat', color: '#f97316' },
  sangat_berat: { label: 'Sangat Berat', color: '#ef4444' },
};

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
  const [regionNames, setRegionNames] = useState<Record<string, string>>({});
  const [reporterNames, setReporterNames] = useState<Record<string, string>>({});
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

  // Peta id wilayah → nama (untuk grafik perbandingan & ekspor)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('regions').select('id, name');
      const map: Record<string, string> = {};
      (data as Array<{ id: string; name: string }> | null)?.forEach((r) => { map[r.id] = r.name; });
      setRegionNames(map);
    })();
  }, [supabase]);

  // Peta id pelapor → nama (untuk kolom Pelapor pada ekspor)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      const map: Record<string, string> = {};
      (data as Array<{ id: string; full_name: string }> | null)?.forEach((r) => { map[r.id] = r.full_name; });
      setReporterNames(map);
    })();
  }, [supabase]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('reports')
      .select('status, severity, created_at, region_id, reporter_id, address, water_height_cm')
      .gte('created_at', new Date(range.from + 'T00:00:00').toISOString())
      .lte('created_at', new Date(range.to + 'T23:59:59').toISOString())
      .order('created_at', { ascending: true });
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

  // FR-025 — tren harian (total + terverifikasi)
  const trend = useMemo<TrendPoint[]>(() => {
    const buckets = new Map<string, { total: number; verified: number }>();
    // pre-isi semua hari pada rentang agar garis kontinu
    const start = new Date(range.from + 'T00:00:00');
    const end = new Date(range.to + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      buckets.set(d.toISOString().slice(0, 10), { total: 0, verified: 0 });
    }
    rows.forEach((r) => {
      const key = r.created_at.slice(0, 10);
      const b = buckets.get(key) ?? { total: 0, verified: 0 };
      b.total += 1;
      if (r.status === 'verified') b.verified += 1;
      buckets.set(key, b);
    });
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ label: k.slice(5).split('-').reverse().join('/'), total: v.total, verified: v.verified }));
  }, [rows, range.from, range.to]);

  // FR-026 — distribusi status & keparahan
  const statusSlices = useMemo<Slice[]>(() =>
    Object.entries(STATUS_META).map(([key, m]) => ({
      name: m.label, color: m.color, value: rows.filter((r) => r.status === key).length,
    })), [rows]);

  const severitySlices = useMemo<Slice[]>(() =>
    Object.entries(SEVERITY_META).map(([key, m]) => ({
      name: m.label, color: m.color, value: rows.filter((r) => r.severity === key).length,
    })), [rows]);

  // FR-028 — perbandingan wilayah (top 7)
  const regionData = useMemo<RegionDatum[]>(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      if (!r.region_id) return;
      counts.set(r.region_id, (counts.get(r.region_id) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, n]) => ({ name: regionNames[id] ?? 'Tanpa wilayah', total: n }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);
  }, [rows, regionNames]);

  // FR-027 — baris ekspor (detail: pelapor, ketinggian, wilayah, alamat)
  const exportRows = useMemo<ExportRow[]>(() =>
    rows.map((r, i) => ({
      no: i + 1,
      tanggal: new Date(r.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      pelapor: r.reporter_id ? (reporterNames[r.reporter_id] ?? '-') : '-',
      status: STATUS_META[r.status]?.label ?? r.status,
      keparahan: SEVERITY_META[r.severity]?.label ?? r.severity,
      ketinggian: r.water_height_cm != null ? String(r.water_height_cm) : '-',
      wilayah: r.region_id ? (regionNames[r.region_id] ?? '-') : '-',
      alamat: r.address ?? '-',
    })), [rows, regionNames, reporterNames]);

  const exportSubtitle = useMemo(() => {
    const wil = regionId ? (regionNames[regionId] ?? 'Wilayah terpilih') : 'Semua wilayah';
    return `${wil} · ${range.from} s/d ${range.to}`;
  }, [regionId, regionNames, range.from, range.to]);

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
    <>
      <style>{`
        .dash-page { padding: 1rem; max-width: 920px; margin: 0 auto; padding-bottom: 88px; overflow-y: auto; height: 100%; }
        .dash-charts { display: grid; grid-template-columns: 1fr; gap: 1rem; margin-top: 1rem; }
        @media (min-width: 1024px) {
          .dash-page { max-width: 1180px; padding: 1.5rem 2rem; }
          .dash-charts { grid-template-columns: 1.4fr 1fr; align-items: start; }
        }
        @media (min-width: 1440px) {
          .dash-page { max-width: 1320px; }
        }
      `}</style>
      <div className="dash-page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <LayoutDashboard size={20} color="var(--primary-400)" />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Dashboard</h1>
        </div>
        <ExportButtons rows={exportRows} meta={{ title: 'Laporan FloodSense', subtitle: exportSubtitle }} />
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
        <>
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

          {total === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', marginTop: '1.5rem' }}>
              Tidak ada laporan pada filter ini.
            </p>
          ) : (
            <div className="dash-charts">
              {/* Kolom kiri: tren harian + perbandingan wilayah */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <TrendingUp size={16} color="var(--primary-400)" />
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Tren Laporan Harian</h2>
                  </div>
                  <TrendChart data={trend} />
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <BarChart3 size={16} color="var(--primary-400)" />
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Perbandingan Antar Wilayah</h2>
                  </div>
                  <RegionComparison data={regionData} />
                </div>
              </div>

              {/* Kolom kanan: distribusi status + tingkat keparahan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <PieChart size={16} color="var(--primary-400)" />
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Distribusi Status</h2>
                  </div>
                  <StatusDonut data={statusSlices} />
                </div>
                <div className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <BarChart3 size={16} color="var(--primary-400)" />
                    <h2 style={{ fontSize: '0.875rem', fontWeight: 700 }}>Tingkat Keparahan</h2>
                  </div>
                  <SeverityBars data={severitySlices} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </>
  );
}
