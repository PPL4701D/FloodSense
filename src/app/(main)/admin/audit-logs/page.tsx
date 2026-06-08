'use client';

/**
 * FR-032 — Audit Log Viewer (admin only)
 *
 * Log aktivitas append-only: filter action_type / admin pelaku / rentang tanggal,
 * pencarian kata kunci, update realtime + tombol muat ulang, tiap entri menampilkan
 * waktu, admin pelaku, aksi, target, dan detail (delta), ekspor CSV, pagination.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import WaveLoader from '@/components/ui/WaveLoader';
import { ScrollText, Filter, Download, ChevronDown, ChevronRight, Loader2, Search, RefreshCw, User, ChevronLeft } from 'lucide-react';

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
interface ActorOption { id: string; name: string }

const KNOWN_ACTIONS = [
  'REPORT_VERIFY', 'REPORT_REJECT', 'REPORT_SCHEDULE_CHECK', 'REPORT_MODERATE',
  'ROLE_CHANGE', 'USER_UPDATE', 'REGION_CREATE', 'REGION_UPDATE', 'REGION_DELETE',
  'REGION_BOUNDARY_UPDATE', 'DATA_EXPORT',
];

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  });
}

function deltaPreview(delta: Record<string, unknown> | null): string {
  if (!delta) return '';
  return Object.entries(delta)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [actionType, setActionType] = useState('');
  const [actorId, setActorId] = useState('');
  const [search, setSearch] = useState('');
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
      if (actorId) p.set('actor_id', actorId);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      return `/api/admin/audit-logs?${p.toString()}`;
    },
    [actionType, actorId, from, to]
  );

  const fetchFirst = useCallback(async () => {
    setLoading(true);
    setPage(0);
    try {
      const res = await fetch(buildUrl(0));
      const json = await res.json();
      setLogs(json.logs ?? []);
      setHasMore(!!json.hasMore);
      if (json.actors) setActors(json.actors);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    if (role === 'admin') fetchFirst();
  }, [role, fetchFirst]);

  // Realtime: log baru langsung muncul (refetch halaman pertama bila ada INSERT).
  useEffect(() => {
    if (role !== 'admin') return;
    const ch = supabase
      .channel('audit_logs_rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => { fetchFirst(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [role, supabase, fetchFirst]);

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

  // Pencarian kata kunci (client-side) pada log yang termuat.
  const visibleLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((l) =>
      l.actor_name.toLowerCase().includes(term) ||
      l.action_type.toLowerCase().includes(term) ||
      (l.target_type ?? '').toLowerCase().includes(term) ||
      (l.target_id ?? '').toLowerCase().includes(term) ||
      deltaPreview(l.delta).toLowerCase().includes(term)
    );
  }, [logs, search]);

  const exportCsv = () => {
    const header = ['Waktu', 'Admin Pelaku', 'Aksi', 'Target Type', 'Target ID', 'Detail'];
    const rows = visibleLogs.map((l) => [
      fmt(l.created_at), l.actor_name, l.action_type,
      l.target_type ?? '', l.target_id ?? '', l.delta ? JSON.stringify(l.delta) : '',
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

  const inputStyle: React.CSSProperties = {
    padding: '0.45rem 0.6rem', fontSize: '0.8125rem', background: 'var(--bg-elevated)',
    color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '900px', margin: '0 auto', paddingBottom: '88px', height: '100%', overflowY: 'auto' }}>
      <button onClick={() => router.push('/admin')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '0.75rem' }}>
        <ChevronLeft size={16} /> Kembali ke Admin
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <ScrollText size={20} color="var(--primary-400)" />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Audit Log</h1>
        <button onClick={fetchFirst} title="Muat ulang" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.7rem', cursor: 'pointer' }}>
          <RefreshCw size={14} /> Refresh
        </button>
        <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--primary-400)', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem', cursor: 'pointer' }}>
          <Download size={14} /> Ekspor CSV
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kata kunci (aksi, target, detail, pelaku)…" style={{ ...inputStyle, width: '100%', paddingLeft: '2rem' }} />
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '0.875rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={15} color="var(--text-muted)" />
        <select style={{ ...inputStyle, cursor: 'pointer' }} value={actionType} onChange={(e) => setActionType(e.target.value)}>
          <option value="">Semua aksi</option>
          {KNOWN_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select style={{ ...inputStyle, cursor: 'pointer' }} value={actorId} onChange={(e) => setActorId(e.target.value)}>
          <option value="">Semua admin pelaku</option>
          {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="date" style={inputStyle} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
        <input type="date" style={inputStyle} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>

      {/* List */}
      {visibleLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Tidak ada log sesuai filter
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {visibleLogs.map((l) => {
            const isOpen = expanded === l.id;
            const preview = deltaPreview(l.delta);
            return (
              <div key={l.id} className="card" style={{ padding: '0.75rem 0.875rem' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : l.id)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  {l.delta ? (isOpen ? <ChevronDown size={15} color="var(--text-muted)" style={{ marginTop: 2 }} /> : <ChevronRight size={15} color="var(--text-muted)" style={{ marginTop: 2 }} />) : <span style={{ width: 15 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary-400)' }}>{l.action_type}</span>
                      {l.target_type && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: '4px' }}>
                          {l.target_type}{l.target_id ? ` #${l.target_id.slice(0, 8)}` : ''}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <User size={11} /> {l.actor_name} · {fmt(l.created_at)}
                    </p>
                    {preview && !isOpen && (
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {preview}
                      </p>
                    )}
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

          {hasMore && !search && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
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
