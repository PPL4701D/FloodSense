'use client';

/**
 * FR-043 + FR-044 — Daftar Laporan dengan Filter Lanjutan & Pagination
 *
 * Filter: pencarian, tingkat keparahan, status, wilayah, rentang tanggal, sort.
 * Pagination: infinite scroll (batch 20) via Supabase .range().
 * State filter disinkronkan ke URL query params (shareable) tanpa useSearchParams
 * (dibaca dari window.location, ditulis via history.replaceState) agar build-safe.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import WaveLoader from '@/components/ui/WaveLoader';
import { createClient } from '@/lib/supabase/client';
import { SEVERITY_LABELS } from '@/types/database';
import type { SeverityLevel, ReportStatus } from '@/types/database';
import { Droplets, MapPin, Clock, ChevronRight, Search, Loader2, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import RegionFilter from '@/components/dashboard/RegionFilter';

interface ReportListItem {
  id: string;
  severity: SeverityLevel;
  status: ReportStatus;
  description: string | null;
  water_height_cm: number | null;
  created_at: string;
  address: string | null;
  credibility_score: number;
}


type SortKey = 'terbaru' | 'kredibilitas';

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Menunggu',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
  flagged: 'Ditandai',
  dalam_peninjauan: 'Dalam Peninjauan',
  moderated: 'Dimoderasi',
};

const PAGE_SIZE = 20;

const selectStyle: React.CSSProperties = {
  width: 'auto', paddingRight: '2.1rem', appearance: 'none', cursor: 'pointer',
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.7rem center',
  backgroundSize: '14px',
};

export default function ReportsPage() {
  const supabase = createClient();

  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [descIds, setDescIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel | 'all'>('all');
  const [status, setStatus] = useState<ReportStatus | 'all'>('all');
  const [regionId, setRegionId] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<SortKey>('terbaru');

  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hydrated = useRef(false);

  // --- Hydrate filters from URL on mount ---
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('q')) { setSearch(p.get('q')!); setDebouncedSearch(p.get('q')!); }
    if (p.get('severity')) setSeverity(p.get('severity') as SeverityLevel);
    if (p.get('status')) setStatus(p.get('status') as ReportStatus);
    if (p.get('region')) setRegionId(p.get('region')!);
    if (p.get('from')) setDateFrom(p.get('from')!);
    if (p.get('to')) setDateTo(p.get('to')!);
    if (p.get('sort') === 'kredibilitas') setSort('kredibilitas');
    hydrated.current = true;
  }, []);

  // --- Wilayah turunan untuk filter hierarkis (provinsi → kab/kota → kecamatan) ---
  useEffect(() => {
    if (regionId === 'all') { setDescIds(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('region_descendant_ids', { p_region: regionId });
      if (cancelled) return;
      setDescIds(((data as Array<{ id: string }> | null) ?? []).map((r) => r.id));
    })();
    return () => { cancelled = true; };
  }, [regionId, supabase]);

  // --- Debounce search ---
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // --- Sync filters → URL ---
  useEffect(() => {
    if (!hydrated.current) return;
    const p = new URLSearchParams();
    if (debouncedSearch) p.set('q', debouncedSearch);
    if (severity !== 'all') p.set('severity', severity);
    if (status !== 'all') p.set('status', status);
    if (regionId !== 'all') p.set('region', regionId);
    if (dateFrom) p.set('from', dateFrom);
    if (dateTo) p.set('to', dateTo);
    if (sort !== 'terbaru') p.set('sort', sort);
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [debouncedSearch, severity, status, regionId, dateFrom, dateTo, sort]);

  const buildQuery = useCallback(
    (from: number, to: number) => {
      let q = supabase
        .from('reports')
        .select('id, severity, status, description, water_height_cm, created_at, address, credibility_score');

      if (severity !== 'all') q = q.eq('severity', severity);
      if (status !== 'all') q = q.eq('status', status);
      if (regionId !== 'all' && descIds) q = q.in('region_id', descIds);
      if (dateFrom) q = q.gte('created_at', new Date(dateFrom + 'T00:00:00').toISOString());
      if (dateTo) q = q.lte('created_at', new Date(dateTo + 'T23:59:59').toISOString());
      if (debouncedSearch) {
        const term = debouncedSearch.replace(/[%,]/g, '');
        q = q.or(`description.ilike.%${term}%,address.ilike.%${term}%`);
      }

      q =
        sort === 'kredibilitas'
          ? q.order('credibility_score', { ascending: false })
          : q.order('created_at', { ascending: false });

      return q.range(from, to);
    },
    [supabase, severity, status, regionId, descIds, dateFrom, dateTo, debouncedSearch, sort]
  );

  // --- Fetch first page when filters change ---
  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    offsetRef.current = 0;
    const { data, error } = await buildQuery(0, PAGE_SIZE - 1);
    if (error) {
      console.error('Error fetching reports:', error);
      setReports([]);
      setLoading(false);
      return;
    }
    const rows = (data as ReportListItem[]) ?? [];
    setReports(rows);
    offsetRef.current = rows.length;
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [buildQuery]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  // --- Load more (infinite scroll) ---
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const from = offsetRef.current;
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (!error && data) {
      const rows = data as ReportListItem[];
      setReports((prev) => [...prev, ...rows]);
      offsetRef.current = from + rows.length;
      setHasMore(rows.length === PAGE_SIZE);
    }
    setLoadingMore(false);
  }, [buildQuery, hasMore, loading, loadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const resetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSeverity('all');
    setStatus('all');
    setRegionId('all');
    setDateFrom('');
    setDateTo('');
    setSort('terbaru');
  };

  const hasActiveFilter =
    !!debouncedSearch || severity !== 'all' || status !== 'all' ||
    regionId !== 'all' || !!dateFrom || !!dateTo || sort !== 'terbaru';

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header: title + filters */}
      <div style={{ padding: '1rem 1rem 0', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Laporan Banjir</h1>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
            placeholder="Cari lokasi atau deskripsi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter: keparahan / status / wilayah / sort — grid 2 kolom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <select className="input" style={{ ...selectStyle, width: '100%' }} value={severity} onChange={(e) => setSeverity(e.target.value as SeverityLevel | 'all')}>
            <option value="all">Semua keparahan</option>
            <option value="ringan">Ringan</option>
            <option value="sedang">Sedang</option>
            <option value="berat">Berat</option>
            <option value="sangat_berat">Sangat Berat</option>
          </select>
          <select className="input" style={{ ...selectStyle, width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value as ReportStatus | 'all')}>
            <option value="all">Semua status</option>
            {(Object.keys(STATUS_LABELS) as ReportStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <RegionFilter value={regionId === 'all' ? null : regionId} onChange={(id) => setRegionId(id ?? 'all')} />
          <select className="input" style={{ ...selectStyle, width: '100%' }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="terbaru">Urutkan: Terbaru</option>
            <option value="kredibilitas">Urutkan: Kredibilitas</option>
          </select>
        </div>

        {hasActiveFilter && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button
              onClick={resetFilters}
              className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-400)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <RotateCcw size={13} /> Reset filter
            </button>
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 1rem 88px', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0' }}>
            <WaveLoader size={48} />
          </div>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <Droplets size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {hasActiveFilter ? 'Tidak ada laporan sesuai filter' : 'Belum ada laporan'}
            </p>
            {hasActiveFilter && (
              <button onClick={resetFilters} className="btn btn-primary" style={{ fontSize: '0.8125rem' }}>
                Reset filter
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {reports.map((report) => {
              const sevKey = report.severity === 'sangat_berat' ? 'sangat-berat' : report.severity;
              const sevColor = `var(--severity-${sevKey})`;
              return (
                <Link key={report.id} href={`/report/${report.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div style={{
                    display: 'flex', alignItems: 'stretch',
                    background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden', cursor: 'pointer',
                    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = sevColor;
                      (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px ${sevColor}40`;
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-primary)';
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ width: '4px', background: sevColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, padding: '0.75rem 0.875rem', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                        <MapPin size={13} color={sevColor} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {report.address || report.description || 'Lokasi tidak tersedia'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                        <span className={`badge badge-severity-${report.severity}`}>{SEVERITY_LABELS[report.severity]}</span>
                        <span className={`badge badge-status-${report.status}`}>{STATUS_LABELS[report.status]}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          <Clock size={10} />
                          {new Date(report.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {report.water_height_cm && (
                          <>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--border-hover)' }}>·</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              <Droplets size={10} color={sevColor} />
                              {report.water_height_cm} cm
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', paddingRight: '0.75rem', flexShrink: 0 }}>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} style={{ height: '1px' }} />
            {loadingMore && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
                <Loader2 size={20} className="animate-spin" color="var(--text-muted)" />
              </div>
            )}
            {!hasMore && reports.length > 0 && (
              <p style={{ textAlign: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.75rem 0' }}>
                — Semua laporan telah dimuat —
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
