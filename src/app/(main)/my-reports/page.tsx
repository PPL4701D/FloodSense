'use client';

import { useEffect, useState, useCallback } from 'react';
import WaveLoader from '@/components/ui/WaveLoader';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { SEVERITY_LABELS } from '@/types/database';
import type { SeverityLevel, ReportStatus } from '@/types/database';
import {
  Droplets, Clock, ChevronRight, Loader2, AlertCircle,
  Trash2, Edit3, FileText, ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';

interface MyReport {
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

const STATUS_COLORS: Record<ReportStatus, { bg: string; text: string }> = {
  pending: { bg: 'rgba(234,179,8,0.12)', text: '#eab308' },
  verified: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
  rejected: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
  flagged: { bg: 'rgba(249,115,22,0.12)', text: '#f97316' },
  dalam_peninjauan: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
  moderated: { bg: 'rgba(148,163,184,0.12)', text: '#94a3b8' },
};

const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  ringan: '#22c55e',
  sedang: '#eab308',
  berat: '#f97316',
  sangat_berat: '#ef4444',
};

export default function MyReportsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [reports, setReports] = useState<MyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/my-reports');
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchMyReports = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('reports')
      .select('id, severity, status, description, water_height_cm, created_at, address, credibility_score')
      .eq('reporter_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching my reports:', error);
      return;
    }
    setReports(data || []);
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (user) fetchMyReports();
  }, [user, fetchMyReports]);

  const handleDelete = async (reportId: string) => {
    const confirmed = confirm('Hapus laporan ini? Tindakan ini tidak bisa dibatalkan.');
    if (!confirmed) return;

    setDeleteId(reportId);
    const { error } = await supabase.from('reports').delete().eq('id', reportId);
    if (error) {
      console.error('Error deleting report:', error);
      alert('Gagal menghapus laporan: ' + error.message);
    } else {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    }
    setDeleteId(null);
  };

  if (authLoading || !user) {
    return (
      <div style={{
        minHeight: '100dvh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '640px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}
        >
          <ChevronLeft size={20} color="var(--text-primary)" />
        </button>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Laporan Saya</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {reports.length} laporan
          </p>
        </div>
      </div>

      {/* Report List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0' }}>
          <WaveLoader size={48} />
        </div>
      ) : reports.length === 0 ? (
        <div className="animate-fade-in" style={{
          textAlign: 'center', padding: '3rem 1rem',
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: 'var(--radius-full)',
            background: 'rgba(59,130,246,0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
          }}>
            <FileText size={28} color="var(--primary-400)" style={{ opacity: 0.6 }} />
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Anda belum membuat laporan banjir
          </p>
          <Link href="/report/new" className="btn btn-primary">
            Buat Laporan Pertama
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reports.map((report) => (
            <div
              key={report.id}
              className="card animate-fade-in"
              style={{ padding: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {/* Severity icon */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
                  background: `${SEVERITY_COLORS[report.severity]}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Droplets size={18} color={SEVERITY_COLORS[report.severity]} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: `${SEVERITY_COLORS[report.severity]}15`,
                      color: SEVERITY_COLORS[report.severity],
                    }}>
                      {SEVERITY_LABELS[report.severity]}
                    </span>
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 500, padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: STATUS_COLORS[report.status].bg,
                      color: STATUS_COLORS[report.status].text,
                    }}>
                      {STATUS_LABELS[report.status]}
                    </span>
                  </div>

                  {report.description && (
                    <p style={{
                      fontSize: '0.8125rem', color: 'var(--text-secondary)',
                      marginBottom: '0.375rem',
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {report.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      display: 'flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.6875rem', color: 'var(--text-muted)',
                    }}>
                      <Clock size={10} />
                      {new Date(report.created_at).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {report.water_height_cm && (
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {report.water_height_cm} cm
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions (only show for pending reports) */}
              {report.status === 'pending' && (
                <div style={{
                  display: 'flex', gap: '0.5rem',
                  marginTop: '0.75rem', paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-primary)',
                }}>
                  <button
                    onClick={() => handleDelete(report.id)}
                    disabled={deleteId === report.id}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '0.375rem', padding: '8px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)',
                      color: '#ef4444', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    {deleteId === report.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    Hapus
                  </button>
                </div>
              )}

              {/* Rejection reason */}
              {report.status === 'rejected' && (
                <div style={{
                  marginTop: '0.75rem', paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-primary)',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
                    background: 'rgba(239,68,68,0.08)',
                    fontSize: '0.75rem', color: '#ef4444',
                  }}>
                    <AlertCircle size={12} />
                    Laporan ditolak oleh verifikator
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
