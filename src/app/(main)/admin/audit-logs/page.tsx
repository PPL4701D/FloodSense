'use client';

/**
 * FR-032 — Audit Log Viewer (admin only)
 *
 * Menampilkan log aktivitas append-only dengan filter action_type + rentang tanggal,
 * row expand untuk delta JSON, ekspor CSV, dan pagination "muat lebih banyak".
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import WaveLoader from '@/components/ui/WaveLoader';
import { ScrollText, Filter, Download, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

interface AuditLogRow {
  id: string;
  actor_id: string;
  actor_name: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  delta: Record<string, unknown> | null;
  created_at: string;
}

const KNOWN_ACTIONS = [
  'REPORT_VERIFY',
  'REPORT_REJECT',
  'REPORT_SCHEDULE_CHECK',
  'ROLE_CHANGE',
  'REPORT_MODERATE',
  'DATA_EXPORT',
];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  });
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [actionType, setActionType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Guard: admin only
  useEffect(() => {
    if (!authLoading && role !== 'admin') router.replace('/');
  }, [authLoading, role, router]);

  const buildUrl = useCallback(
    (pageNum: number) => {
      const p = new URLSearchParams({ page: String(pageNum) });
      if (actionType) p.set('action_type', actionType);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      return `/api/admin/audit-logs?${p.toString()}`;
    },
    [actionType, from, to]
  );

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    setPage(0);
    try {
      const res = await fetch(buildUrl(0));
      const json = await res.json();
      setLogs(json.logs ?? []);
      setHasMore(!!json.hasMore);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    if (role === 'admin') fetchFirst();
  }, [role, fetchFirst]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = page + 1;
    try {
      const res = await fetch(buildUrl(next));
      const json = await res.json();
      setLogs((prev) => [...prev, ...(json.logs ?? [])]);
      setPage(next);
      setHasMore(!!json.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = () => {
    const header = ['Waktu', 'Actor', 'Aksi', 'Target Type', 'Target ID', 'Delta'];
    const rows = logs.map((l) => [
      fmt(l.created_at),
      l.actor_name,
      l.action_type,
      l.target_type ?? '',
      l.target_id ?? '',
      l.delta ? JSON.stringify(l.delta) : '',
    ]);
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading || (loading && logs.length === 0)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto', paddingBottom: '88px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <ScrollText size={20} color="var(--primary-400)" />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Audit Log</h1>
        <button
          onClick={exportCsv}
          className="btn-ghost"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary-400)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem', cursor: 'pointer' }}
        >
          <Download size={14} /> Ekspor CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '0.875rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={15} color="var(--text-muted)" />
        <select className="input" style={{ width: 'auto' }} value={actionType} onChange={(e) => setActionType(e.target.value)}>
          <option value="">Semua aksi</option>
          {KNOWN_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" className="input" style={{ width: 'auto' }} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
        <input type="date" className="input" style={{ width: 'auto' }} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>

      {/* List */}
      {logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Tidak ada log sesuai filter
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {logs.map((l) => {
            const isOpen = expanded === l.id;
            return (
              <div key={l.id} className="card" style={{ padding: '0.75rem 0.875rem' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : l.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  {l.delta ? (isOpen ? <ChevronDown size={15} color="var(--text-muted)" /> : <ChevronRight size={15} color="var(--text-muted)" />) : <span style={{ width: 15 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary-400)' }}>{l.action_type}</span>
                      {l.target_type && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '4px' }}>
                          {l.target_type}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      {l.actor_name} · {fmt(l.created_at)}
                    </p>
                  </div>
                </button>
                {isOpen && l.delta && (
                  <pre style={{
                    marginTop: '0.625rem', padding: '0.625rem', background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.6875rem', color: 'var(--text-secondary)',
                    overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {JSON.stringify(l.delta, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="btn-ghost"
              style={{ margin: '0.5rem auto', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary-400)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', padding: '0.5rem 1rem', cursor: 'pointer' }}
            >
              {loadingMore ? <Loader2 size={14} className="animate-spin" /> : null}
              Muat lebih banyak
            </button>
          )}
        </div>
      )}
    </div>
  );
}
