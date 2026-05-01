'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import WaveLoader from '@/components/ui/WaveLoader';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import type {
  SeverityLevel, ReportStatus, VerificationDecision,
} from '@/types/database';
import { SEVERITY_LABELS } from '@/types/database';
import {
  Shield, Clock, CheckCircle2, XCircle, AlertTriangle,
  Droplets, MapPin, ChevronDown, Loader2, ThumbsUp, ThumbsDown,
  Calendar, Eye, ChevronLeft, ExternalLink, Filter,
  Search, Flag, TrendingUp, BarChart3, X, Activity, User,
} from 'lucide-react';

// ---- Types ----
interface StaffReport {
  id: string;
  severity: SeverityLevel;
  status: ReportStatus;
  description: string | null;
  water_height_cm: number | null;
  address: string | null;
  credibility_score: number;
  created_at: string;
  is_surge_receding: boolean;
  region_id: string | null;
  reporter: { id: string; full_name: string; reputation_score: number; avatar_url: string | null } | null;
  photos: { id: string; storage_path: string }[];
  votes: { upvotes: number; downvotes: number };
  location: { type: string; coordinates: number[] };
}

// ---- Constants ----
const SEVERITY_CONFIG: Record<SeverityLevel, { color: string; bg: string; label: string }> = {
  ringan:      { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: 'Ringan' },
  sedang:      { color: '#eab308', bg: 'rgba(234,179,8,0.12)',   label: 'Sedang' },
  berat:       { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  label: 'Berat' },
  sangat_berat:{ color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Sangat Berat' },
};

const STATUS_MAP: Record<ReportStatus, { color: string; bg: string; label: string; icon: typeof Clock }> = {
  pending:          { color: '#eab308', bg: 'rgba(234,179,8,0.12)',  label: 'Menunggu',        icon: Clock },
  verified:         { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'Terverifikasi',    icon: CheckCircle2 },
  rejected:         { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Ditolak',          icon: XCircle },
  flagged:          { color: '#f97316', bg: 'rgba(249,115,22,0.12)',label: 'Ditandai',         icon: AlertTriangle },
  dalam_peninjauan: { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',label: 'Dalam Peninjauan', icon: Eye },
  moderated:        { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)',label: 'Dimoderasi',      icon: Shield },
};

// ---- Verification Page ----
export default function StaffVerificationPage() {
  const { user, role, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [reports, setReports] = useState<StaffReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'flagged'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !['staf', 'tlm', 'admin'].includes(role || ''))) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, role, router]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('reports')
      .select(`
        id, severity, status, description, water_height_cm,
        address, credibility_score, created_at, is_surge_receding, location, region_id,
        profiles!reports_reporter_id_fkey (id, full_name, reputation_score, avatar_url),
        report_photos (id, storage_path)
      `)
      .order('credibility_score', { ascending: false })
      .limit(100);

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    } else {
      query = query.in('status', ['pending', 'flagged', 'dalam_peninjauan']);
    }

    const { data, error } = await query;
    if (error) { console.error('Error fetching reports:', error); setLoading(false); return; }

    const reportIds = (data || []).map((r: Record<string, unknown>) => r.id as string);
    const voteCounts: Record<string, { upvotes: number; downvotes: number }> = {};

    if (reportIds.length > 0) {
      const { data: votes } = await supabase
        .from('votes').select('report_id, vote_type').in('report_id', reportIds);
      if (votes) {
        votes.forEach((v: { report_id: string; vote_type: string }) => {
          if (!voteCounts[v.report_id]) voteCounts[v.report_id] = { upvotes: 0, downvotes: 0 };
          if (v.vote_type === 'upvote') voteCounts[v.report_id].upvotes++;
          else voteCounts[v.report_id].downvotes++;
        });
      }
    }

    const mapped: StaffReport[] = (data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      severity: r.severity as SeverityLevel,
      status: r.status as ReportStatus,
      description: r.description as string | null,
      water_height_cm: r.water_height_cm as number | null,
      address: r.address as string | null,
      credibility_score: r.credibility_score as number,
      created_at: r.created_at as string,
      is_surge_receding: r.is_surge_receding as boolean,
      region_id: r.region_id as string | null,
      reporter: r.profiles as StaffReport['reporter'],
      photos: (r.report_photos as StaffReport['photos']) || [],
      votes: voteCounts[r.id as string] || { upvotes: 0, downvotes: 0 },
      location: r.location as { type: string; coordinates: number[] },
    }));

    setReports(mapped);
    setLoading(false);
  }, [supabase, filterStatus]);

  useEffect(() => {
    if (user && ['staf', 'tlm', 'admin'].includes(role || '')) fetchReports();
  }, [user, role, fetchReports]);

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter((r) =>
      r.description?.toLowerCase().includes(q) ||
      r.address?.toLowerCase().includes(q) ||
      r.reporter?.full_name?.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q)
    );
  }, [reports, searchQuery]);

  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    flagged: reports.filter((r) => r.status === 'flagged').length,
    reviewing: reports.filter((r) => r.status === 'dalam_peninjauan').length,
  }), [reports]);

  const selectedReport = filteredReports.find((r) => r.id === selectedId);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  return (
    <div className="page-scroll" style={{ paddingBottom: '100px' }}>

      {/* ── Sticky Header ─────────────────────────────── */}
      <div style={{
        position: 'sticky', top: '56px', zIndex: 100,
        background: 'rgba(10,15,30,0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        {/* Title row */}
        <div style={{ padding: '0.875rem 1rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', color: 'var(--text-primary)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.2 }}>Verifikasi Laporan</h1>
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              {filteredReports.length} laporan memerlukan perhatian
            </p>
          </div>
          {/* Filter dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '6px 10px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer', fontSize: '0.75rem', color: 'var(--text-secondary)',
              }}
            >
              <Filter size={12} />
              {filterStatus === 'all' ? 'Semua' : filterStatus === 'pending' ? 'Menunggu' : 'Ditandai'}
              <ChevronDown size={11} />
            </button>
            {showFilterMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                overflow: 'hidden', zIndex: 50, minWidth: '150px',
              }}>
                {([
                  { key: 'all' as const, label: 'Semua', count: stats.total },
                  { key: 'pending' as const, label: 'Menunggu', count: stats.pending },
                  { key: 'flagged' as const, label: 'Ditandai', count: stats.flagged },
                ]).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setFilterStatus(opt.key); setShowFilterMenu(false); }}
                    style={{
                      display: 'flex', width: '100%', padding: '9px 14px',
                      border: 'none', background: filterStatus === opt.key ? 'rgba(59,130,246,0.1)' : 'transparent',
                      color: filterStatus === opt.key ? 'var(--primary-400)' : 'var(--text-secondary)',
                      fontSize: '0.8125rem', cursor: 'pointer', textAlign: 'left',
                      alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{
                      fontSize: '0.625rem', fontWeight: 700,
                      background: 'rgba(255,255,255,0.07)', padding: '1px 7px',
                      borderRadius: '99px', color: 'var(--text-muted)',
                    }}>{opt.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: '0', padding: '0.625rem 1rem' }}>
          {[
            { label: 'Menunggu', value: stats.pending, color: '#eab308', icon: Clock },
            { label: 'Ditandai', value: stats.flagged, color: '#f97316', icon: Flag },
            { label: 'Ditinjau', value: stats.reviewing, color: '#3b82f6', icon: Eye },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{
                flex: 1,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '8px',
                  background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={13} color={s.color} />
                </div>
                <div>
                  <p style={{ fontSize: '1rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Search bar */}
        <div style={{ padding: '0 1rem 0.875rem', position: 'relative' }}>
          <Search size={13} color="var(--text-muted)" style={{ position: 'absolute', left: '1.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari deskripsi, alamat, atau pelapor…"
            style={{
              width: '100%', padding: '9px 32px 9px 34px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px', color: 'var(--text-primary)',
              fontSize: '0.8125rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '1.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }}
            >
              <X size={13} color="var(--text-muted)" />
            </button>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────── */}
      <div style={{ padding: '1rem', maxWidth: '720px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
            <WaveLoader size={48} />
          </div>
        ) : filteredReports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <Shield size={56} color="var(--text-muted)" strokeWidth={1} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
              {searchQuery ? `Hasil tidak ditemukan untuk "${searchQuery}"` : 'Tidak ada laporan yang perlu diverifikasi'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.375rem' }}>
              Semua laporan sudah ditangani 🎉
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {filteredReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isSelected={selectedId === report.id}
                onClick={() => setSelectedId(selectedId === report.id ? null : report.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Detail Panel ───────────────────────────────── */}
      {selectedReport && (
        <ReportDetailPanel
          report={selectedReport}
          onClose={() => setSelectedId(null)}
          onAction={() => { setSelectedId(null); fetchReports(); }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────
// Report Card
// ────────────────────────────────────────────────
function ReportCard({ report, isSelected, onClick }: {
  report: StaffReport; isSelected: boolean; onClick: () => void;
}) {
  const sev = SEVERITY_CONFIG[report.severity];
  const sta = STATUS_MAP[report.status];
  const StatusIcon = sta.icon;
  const isFlagged = report.status === 'flagged';

  const credColor = report.credibility_score >= 70 ? '#22c55e'
    : report.credibility_score >= 40 ? '#eab308' : '#ef4444';

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        padding: '0',
        background: isSelected
          ? 'rgba(59,130,246,0.08)'
          : isFlagged
            ? 'rgba(249,115,22,0.05)'
            : 'rgba(255,255,255,0.03)',
        border: isSelected
          ? '1px solid rgba(59,130,246,0.4)'
          : isFlagged
            ? '1px solid rgba(249,115,22,0.3)'
            : '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        overflow: 'hidden',
        transition: 'all 0.18s ease',
      }}
    >
      {/* Severity accent line */}
      <div style={{ height: '3px', background: sev.color, opacity: 0.7 }} />

      <div style={{ padding: '0.875rem', display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
        {/* Icon */}
        <div style={{
          width: '44px', height: '44px', borderRadius: '12px',
          background: sev.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Droplets size={20} color={sev.color} />
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badge row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px',
              borderRadius: '99px', background: sev.bg, color: sev.color,
            }}>
              {sev.label}
            </span>
            <span style={{
              fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px',
              borderRadius: '99px', background: sta.bg, color: sta.color,
              display: 'flex', alignItems: 'center', gap: '3px',
            }}>
              <StatusIcon size={9} />
              {sta.label}
            </span>
            {isFlagged && (
              <span style={{
                fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px',
                borderRadius: '99px', background: 'rgba(249,115,22,0.12)', color: '#f97316',
                display: 'flex', alignItems: 'center', gap: '3px',
              }}>
                <Flag size={9} /> Spam/Duplikat
              </span>
            )}
          </div>

          {/* Description */}
          {report.description && (
            <p style={{
              fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500,
              lineHeight: 1.45, marginBottom: '0.5rem',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {report.description}
            </p>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            {report.address && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                <MapPin size={10} />
                {report.address.length > 32 ? report.address.slice(0, 32) + '…' : report.address}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <Clock size={10} />
              {new Date(report.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Right side: credibility */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <span style={{ fontSize: '1.125rem', fontWeight: 800, color: credColor, lineHeight: 1 }}>
            {report.credibility_score}
          </span>
          <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>skor</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
            <ThumbsUp size={10} color="#22c55e" />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{report.votes.upvotes}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <ThumbsDown size={10} color="#ef4444" />
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{report.votes.downvotes}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ────────────────────────────────────────────────
// Detail Panel (Bottom Sheet)
// ────────────────────────────────────────────────
function ReportDetailPanel({ report, onClose, onAction }: {
  report: StaffReport; onClose: () => void; onAction: () => void;
}) {
  const supabase = createClient();
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState<VerificationDecision | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [areaStatus, setAreaStatus] = useState<string | null>(null);
  const [areaStatusLoading, setAreaStatusLoading] = useState(false);
  const [areaStatusMsg, setAreaStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!report.region_id) return;
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('area_status').select('status')
        .eq('region_id', report.region_id).is('valid_until', null)
        .order('valid_from', { ascending: false }).limit(1).maybeSingle();
      setAreaStatus(data?.status ?? 'normal');
    };
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.region_id]);

  const handleAreaStatusAction = async (action: 'mereda' | 'normal') => {
    if (!report.region_id) return;
    setAreaStatusLoading(true); setAreaStatusMsg(null);
    try {
      const res = await fetch('/api/area-status/manual', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region_id: report.region_id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah status');
      setAreaStatus(data.to);
      setAreaStatusMsg(`Status wilayah diubah ke ${data.to.replace('_', ' ').toUpperCase()}`);
    } catch (err) {
      setAreaStatusMsg(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally { setAreaStatusLoading(false); }
  };

  useEffect(() => {
    const loadPhotos = async () => {
      const urls: string[] = [];
      for (const photo of report.photos) {
        const { data } = supabase.storage.from('report-photos').getPublicUrl(photo.storage_path);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }
      setPhotoUrls(urls);
    };
    loadPhotos();
  }, [report.photos, supabase]);

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true); setError(null);
    try {
      const response = await fetch('/api/verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: report.id, decision, notes: notes || '' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memproses verifikasi');
      onAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally { setSubmitting(false); }
  };

  const sev = SEVERITY_CONFIG[report.severity];
  const coord = report.location?.coordinates;
  const lat = coord?.[1];
  const lng = coord?.[0];

  const areaStatusColor = areaStatus === 'banjir_aktif' ? '#ef4444'
    : areaStatus === 'siaga' ? '#f97316'
    : areaStatus === 'waspada' ? '#eab308'
    : areaStatus === 'mereda' ? '#8b5cf6'
    : '#22c55e';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
      <div
        className="animate-slide-up"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
          maxHeight: '88dvh', overflowY: 'auto',
          background: 'var(--bg-card)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px 20px 0 0',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Grab handle */}
        <div style={{ padding: '0.875rem 1.25rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.15)' }} />
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', color: 'var(--text-secondary)' }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ padding: '0.875rem 1.25rem 5.5rem' }}>
          {/* Flagged banner */}
          {report.status === 'flagged' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.625rem',
              padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)',
              marginBottom: '1rem',
            }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Flag size={15} color="#f97316" />
              </div>
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#f97316' }}>Laporan Ditandai oleh Sistem</p>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' }}>Terdeteksi sebagai potensi spam atau duplikasi.</p>
              </div>
            </div>
          )}

          {/* Header card */}
          <div style={{
            background: sev.bg, border: `1px solid ${sev.color}30`,
            borderRadius: '14px', padding: '1rem', marginBottom: '0.875rem',
            display: 'flex', alignItems: 'center', gap: '0.875rem',
          }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: `${sev.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Droplets size={24} color={sev.color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: sev.color }}>{sev.label}</span>
                {report.water_height_cm && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>• {report.water_height_cm} cm</span>
                )}
              </div>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                #{report.id.slice(0, 8)} &nbsp;•&nbsp;
                {new Date(report.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Reporter */}
          {report.reporter && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              marginBottom: '0.875rem',
            }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '99px',
                background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-400)', overflow: 'hidden', flexShrink: 0,
              }}>
                {report.reporter.avatar_url
                  ? <img src={report.reporter.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (report.reporter.full_name?.[0] || '?')}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{report.reporter.full_name}</p>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Pelapor</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{
                  fontSize: '0.875rem', fontWeight: 700,
                  color: report.reporter.reputation_score >= 70 ? '#22c55e'
                    : report.reporter.reputation_score >= 40 ? '#eab308' : '#ef4444',
                }}>{report.reporter.reputation_score}</p>
                <p style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>reputasi</p>
              </div>
            </div>
          )}

          {/* Description */}
          {report.description && (
            <div style={{ marginBottom: '0.875rem' }}>
              <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '0.5rem' }}>Deskripsi</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{report.description}</p>
            </div>
          )}

          {/* Photos */}
          {photoUrls.length > 0 && (
            <div style={{ marginBottom: '0.875rem' }}>
              <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '0.5rem' }}>
                Foto ({photoUrls.length})
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
                {photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
                    <img src={url} alt={`Foto ${i + 1}`} style={{
                      width: '110px', height: '80px', objectFit: 'cover',
                      borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)',
                    }} />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem',
            marginBottom: '0.875rem',
          }}>
            <div style={{ padding: '0.625rem', borderRadius: '10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)', textAlign: 'center' }}>
              <ThumbsUp size={14} color="#22c55e" style={{ margin: '0 auto 3px' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#22c55e' }}>{report.votes.upvotes}</p>
              <p style={{ fontSize: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Setuju</p>
            </div>
            <div style={{ padding: '0.625rem', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', textAlign: 'center' }}>
              <ThumbsDown size={14} color="#ef4444" style={{ margin: '0 auto 3px' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ef4444' }}>{report.votes.downvotes}</p>
              <p style={{ fontSize: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tolak</p>
            </div>
            <div style={{ padding: '0.625rem', borderRadius: '10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)', textAlign: 'center' }}>
              <BarChart3 size={14} color="#3b82f6" style={{ margin: '0 auto 3px' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: report.credibility_score >= 70 ? '#22c55e' : report.credibility_score >= 40 ? '#eab308' : '#ef4444' }}>{report.credibility_score}</p>
              <p style={{ fontSize: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Kredibilitas</p>
            </div>
          </div>

          {/* Location */}
          {lat && lng && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              marginBottom: '0.875rem',
            }}>
              <MapPin size={16} color="var(--text-muted)" />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {report.address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
                </p>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' }}>{lat.toFixed(5)}, {lng.toFixed(5)}</p>
              </div>
              <a
                href={`https://www.google.com/maps?q=${lat},${lng}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  padding: '6px 10px', borderRadius: '8px',
                  background: 'rgba(59,130,246,0.1)', color: 'var(--primary-400)',
                  fontSize: '0.6875rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none',
                }}
              >
                <ExternalLink size={11} /> Maps
              </a>
            </div>
          )}

          {/* Area Status */}
          {report.region_id && (
            <div style={{
              padding: '0.875rem 1rem', borderRadius: '12px',
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${areaStatusColor}30`,
              marginBottom: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <Activity size={13} color={areaStatusColor} />
                <p style={{ fontSize: '0.75rem', fontWeight: 700, flex: 1 }}>Status Wilayah</p>
                <span style={{
                  fontSize: '0.625rem', fontWeight: 800, padding: '2px 10px',
                  borderRadius: '99px', background: `${areaStatusColor}18`, color: areaStatusColor,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {areaStatus?.replace('_', ' ') ?? '—'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['banjir_aktif', 'siaga'].includes(areaStatus || '') && (
                  <button onClick={() => handleAreaStatusAction('mereda')} disabled={areaStatusLoading}
                    style={{
                      padding: '6px 14px', borderRadius: '8px',
                      border: '1px solid rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6',
                      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      opacity: areaStatusLoading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.375rem',
                    }}>
                    {areaStatusLoading ? <Loader2 size={12} className="animate-spin" /> : '📉'} Tandai Mereda
                  </button>
                )}
                {areaStatus === 'mereda' && (
                  <button onClick={() => handleAreaStatusAction('normal')} disabled={areaStatusLoading}
                    style={{
                      padding: '6px 14px', borderRadius: '8px',
                      border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      opacity: areaStatusLoading ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.375rem',
                    }}>
                    {areaStatusLoading ? <Loader2 size={12} className="animate-spin" /> : '✅'} Konfirmasi Normal
                  </button>
                )}
                {['normal', 'waspada'].includes(areaStatus || '') && (
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Evaluasi otomatis — tidak perlu aksi manual</p>
                )}
              </div>
              {areaStatusMsg && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.6875rem', color: areaStatusMsg.includes('Gagal') ? '#ef4444' : '#22c55e' }}>
                  {areaStatusMsg}
                </p>
              )}
            </div>
          )}

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '1rem 0' }} />

          {/* Verification actions */}
          {['pending', 'flagged', 'dalam_peninjauan'].includes(report.status) ? (
            <div>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>Keputusan Verifikasi</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.875rem' }}>
                {([
                  { key: 'verified' as VerificationDecision, label: 'Terima', color: '#22c55e', icon: CheckCircle2 },
                  { key: 'rejected' as VerificationDecision, label: 'Tolak', color: '#ef4444', icon: XCircle },
                  { key: 'scheduled_check' as VerificationDecision, label: 'Tinjau', color: '#3b82f6', icon: Calendar },
                ]).map((d) => {
                  const Icon = d.icon;
                  const active = decision === d.key;
                  return (
                    <button key={d.key} onClick={() => setDecision(d.key)}
                      style={{
                        padding: '10px 6px', borderRadius: '10px',
                        border: `2px solid ${active ? d.color : 'rgba(255,255,255,0.08)'}`,
                        background: active ? `${d.color}15` : 'rgba(255,255,255,0.03)',
                        color: active ? d.color : 'var(--text-muted)',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                        transition: 'all 0.15s ease',
                      }}>
                      <Icon size={18} />
                      {d.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan verifikasi (opsional)…"
                rows={3}
                style={{
                  width: '100%', padding: '0.75rem',
                  borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)',
                  fontSize: '0.8125rem', resize: 'vertical', outline: 'none',
                  marginBottom: '0.875rem', boxSizing: 'border-box',
                }}
              />

              {error && (
                <div style={{ padding: '0.625rem 0.875rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!decision || submitting}
                className="btn btn-primary"
                style={{
                  width: '100%', padding: '13px',
                  opacity: !decision || submitting ? 0.45 : 1,
                  cursor: !decision || submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  borderRadius: '12px', fontWeight: 700,
                }}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                {submitting ? 'Memproses…' : 'Kirim Keputusan'}
              </button>
            </div>
          ) : (
            <div style={{ padding: '1.25rem', borderRadius: '12px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
              <CheckCircle2 size={28} color="#22c55e" style={{ margin: '0 auto 0.625rem' }} />
              <p style={{ fontSize: '0.875rem', color: '#22c55e', fontWeight: 700 }}>Laporan sudah diverifikasi</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
