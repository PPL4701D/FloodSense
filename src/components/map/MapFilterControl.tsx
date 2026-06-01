'use client';

/**
 * FR-045 — Map Filter Control
 *
 * Floating panel untuk memfilter marker peta berdasarkan tingkat keparahan,
 * status, dan rentang waktu. Menulis ke `useMapStore.setFilters`; `useRealtimeReports`
 * sudah otomatis memanggil ulang RPC `get_map_reports` saat filter berubah.
 * State filter dipersist via mapStore (localStorage `floodsense-map-prefs`).
 */

import { useState, useRef, useEffect } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useMapStore } from '@/stores/mapStore';
import type { MapFilters } from '@/stores/mapStore';
import { SEVERITY_LABELS } from '@/types/database';
import type { SeverityLevel, ReportStatus } from '@/types/database';

const SEVERITY_OPTIONS: { value: SeverityLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'ringan', label: SEVERITY_LABELS.ringan },
  { value: 'sedang', label: SEVERITY_LABELS.sedang },
  { value: 'berat', label: SEVERITY_LABELS.berat },
  { value: 'sangat_berat', label: SEVERITY_LABELS.sangat_berat },
];

const STATUS_OPTIONS: { value: ReportStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'verified', label: 'Terverifikasi' },
  { value: 'dalam_peninjauan', label: 'Dalam Peninjauan' },
  { value: 'flagged', label: 'Ditandai' },
];

const TIME_OPTIONS: { value: MapFilters['timeRange']; label: string }[] = [
  { value: '1h', label: '1 jam' },
  { value: '6h', label: '6 jam' },
  { value: '24h', label: '24 jam' },
  { value: '7d', label: '7 hari' },
  { value: '30d', label: '30 hari' },
];

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '0.4rem 0.5rem', fontSize: '0.8125rem',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
  appearance: 'none', cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)',
  marginBottom: '0.25rem', display: 'block',
};

export default function MapFilterControl() {
  const { activeFilters, setFilters } = useMapStore();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Hitung jumlah filter aktif (selain default time 7d)
  const activeCount =
    (activeFilters.severity !== 'all' ? 1 : 0) +
    (activeFilters.status !== 'all' ? 1 : 0) +
    (activeFilters.timeRange !== '7d' ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const resetFilters = () =>
    setFilters({ severity: 'all', status: 'all', timeRange: '7d' });

  return (
    <div ref={wrapRef} style={{ position: 'absolute', top: '80px', left: '16px', zIndex: 1000 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Filter laporan"
        className="glass"
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
          border: `1px solid ${activeCount > 0 ? 'var(--primary-400)' : 'var(--border-primary)'}`,
          cursor: 'pointer', boxShadow: 'var(--shadow-md)',
        }}
      >
        <SlidersHorizontal size={16} color={activeCount > 0 ? 'var(--primary-400)' : 'var(--text-secondary)'} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Filter</span>
        {activeCount > 0 && (
          <span style={{
            minWidth: '16px', height: '16px', padding: '0 4px', borderRadius: '8px',
            background: 'var(--primary-500)', color: '#fff', fontSize: '0.625rem',
            fontWeight: 700, lineHeight: '16px', textAlign: 'center',
          }}>
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="glass"
          style={{
            marginTop: '8px', width: '220px', padding: '0.875rem',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)',
            boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column', gap: '0.75rem',
            animation: 'fadeInUp 0.15s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Filter Laporan</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
              <X size={16} color="var(--text-muted)" />
            </button>
          </div>

          <div>
            <label style={labelStyle}>Tingkat Keparahan</label>
            <select
              style={selectStyle}
              value={activeFilters.severity}
              onChange={(e) => setFilters({ severity: e.target.value as SeverityLevel | 'all' })}
            >
              {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select
              style={selectStyle}
              value={activeFilters.status}
              onChange={(e) => setFilters({ status: e.target.value as ReportStatus | 'all' })}
            >
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Rentang Waktu</label>
            <select
              style={selectStyle}
              value={activeFilters.timeRange}
              onChange={(e) => setFilters({ timeRange: e.target.value as MapFilters['timeRange'] })}
            >
              {TIME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {activeCount > 0 && (
            <button
              onClick={resetFilters}
              className="btn-ghost"
              style={{
                fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-400)',
                padding: '0.4rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-primary)',
                background: 'none', cursor: 'pointer',
              }}
            >
              Reset filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
