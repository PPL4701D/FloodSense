'use client';

import { useEffect, useState, useCallback } from 'react';
import WaveLoader from '@/components/ui/WaveLoader';
import { createClient } from '@/lib/supabase/client';
import { SEVERITY_LABELS } from '@/types/database';
import type { SeverityLevel, ReportStatus } from '@/types/database';
import { Droplets, MapPin, Clock, ChevronRight, Search, Filter, Loader2 } from 'lucide-react';
import Link from 'next/link';

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

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: 'Menunggu',
  verified: 'Terverifikasi',
  rejected: 'Ditolak',
  flagged: 'Ditandai',
  dalam_peninjauan: 'Dalam Peninjauan',
  moderated: 'Dimoderasi',
};

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all');
  const supabase = createClient();

  const fetchReports = useCallback(async () => {
    let query = supabase
      .from('reports')
      .select('id, severity, status, description, water_height_cm, created_at, address, credibility_score')
      .order('created_at', { ascending: false })
      .limit(50);

    if (severityFilter !== 'all') {
      query = query.eq('severity', severityFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching reports:', error);
      return;
    }
    setReports(data || []);
    setLoading(false);
  }, [supabase, severityFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const filtered = reports.filter((r) => {
    if (!search) return true;
    return (
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      r.address?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div style={{
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Fixed header: title + search */}
      <div style={{ padding: '1rem 1rem 0', maxWidth: '640px', width: '100%', margin: '0 auto', boxSizing: 'border-box', flexShrink: 0 }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Laporan Banjir</h1>

        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '2.5rem' }}
              placeholder="Cari laporan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityLevel | 'all')}
            className="input"
            style={{
              width: 'auto', paddingRight: '2rem', appearance: 'none',
              backgroundImage: 'url("data:image/svg+xml,...)"',
            }}
          >
            <option value="all">Semua</option>
            <option value="ringan">Ringan</option>
            <option value="sedang">Sedang</option>
            <option value="berat">Berat</option>
            <option value="sangat_berat">Sangat Berat</option>
          </select>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '0 1rem 88px', /* 88px = bottom nav clearance */
        maxWidth: '640px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0' }}>
            <WaveLoader size={48} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <Droplets size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Belum ada laporan</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filtered.map((report) => {
              const sevKey = report.severity === 'sangat_berat' ? 'sangat-berat' : report.severity;
              const sevColor = `var(--severity-${sevKey})`;
              return (
                <Link key={report.id} href={`/report/${report.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  <div style={{
                    display: 'flex', alignItems: 'stretch',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    cursor: 'pointer',
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
                    {/* Severity accent strip */}
                    <div style={{
                      width: '4px',
                      background: sevColor,
                      flexShrink: 0,
                    }} />

                    {/* Content */}
                    <div style={{ flex: 1, padding: '0.75rem 0.875rem', minWidth: 0 }}>
                      {/* Row 1: Location — most important */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem' }}>
                        <MapPin size={13} color={sevColor} style={{ flexShrink: 0 }} />
                        <span style={{
                          fontSize: '0.875rem', fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {report.address || report.description || 'Lokasi tidak tersedia'}
                        </span>
                      </div>

                      {/* Row 2: Severity + Status badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                        <span className={`badge badge-severity-${report.severity}`}>
                          {SEVERITY_LABELS[report.severity]}
                        </span>
                        <span className={`badge badge-status-${report.status}`}>
                          {STATUS_LABELS[report.status]}
                        </span>
                      </div>

                      {/* Row 3: Time + water height */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          <Clock size={10} />
                          {new Date(report.created_at).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
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

                    {/* Chevron */}
                    <div style={{ display: 'flex', alignItems: 'center', paddingRight: '0.75rem', flexShrink: 0 }}>
                      <ChevronRight size={16} color="var(--text-muted)" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
