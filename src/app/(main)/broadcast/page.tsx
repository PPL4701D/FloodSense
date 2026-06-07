'use client';

/**
 * FR-035 — Halaman Broadcast Peringatan TLM
 *
 * Formulir bagi TLM/Admin untuk menyusun peringatan banjir: pilih wilayah target
 * (multi), tingkat keparahan, dan pesan (≤500 char). Submit ke /api/broadcast yang
 * menyimpan + menyebarkan notifikasi in-app & web-push. Menampilkan riwayat
 * broadcast terbaru.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import WaveLoader from '@/components/ui/WaveLoader';
import { Radio, Send, Info, AlertTriangle, Siren, Loader2, CheckCircle2, MapPin, Search, X } from 'lucide-react';

interface RegionRow { id: string; name: string; level: string; parent_id: string | null }
interface BroadcastRow {
  id: string;
  message: string;
  severity_level: 'informasi' | 'waspada' | 'darurat';
  target_regions: string[];
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

const SEVERITY_OPTIONS = [
  { value: 'informasi', label: 'Informasi', icon: Info, color: '#0891b2' },
  { value: 'waspada', label: 'Waspada', icon: AlertTriangle, color: '#eab308' },
  { value: 'darurat', label: 'Darurat', icon: Siren, color: '#ef4444' },
] as const;

const MAX_LEN = 500;

export default function BroadcastPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<RegionRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [regionMeta, setRegionMeta] = useState<Record<string, { name: string; level: string }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [severity, setSeverity] = useState<'informasi' | 'waspada' | 'darurat'>('waspada');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ recipients: number; pushed: number; usedFallback?: boolean } | null>(null);
  const [history, setHistory] = useState<BroadcastRow[]>([]);

  // Guard: tlm/admin
  useEffect(() => {
    if (!authLoading && !(role && ['tlm', 'admin'].includes(role))) router.replace('/');
  }, [authLoading, role, router]);

  // Pencarian wilayah (debounce) — tidak memuat semua (ribuan) baris sekaligus.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('regions')
        .select('id, name, level, parent_id')
        .ilike('name', `%${term.replace(/[%,]/g, '')}%`)
        .order('level', { ascending: true })
        .order('name', { ascending: true })
        .limit(30);
      const rows = (data as RegionRow[] | null) ?? [];
      setSearchResults(rows);
      setRegionMeta((prev) => {
        const next = { ...prev };
        rows.forEach((r) => { next[r.id] = { name: r.name, level: r.level }; });
        return next;
      });
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [search, supabase]);

  const fetchHistory = useCallback(async () => {
    const { data } = await supabase
      .from('broadcast_messages')
      .select('id, message, severity_level, target_regions, is_active, created_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(8);
    setHistory((data as BroadcastRow[] | null) ?? []);
  }, [supabase]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Resolusi nama wilayah untuk riwayat (id yang belum ada di cache).
  useEffect(() => {
    const ids = new Set<string>();
    history.forEach((b) => b.target_regions.forEach((id) => { if (!regionMeta[id]) ids.add(id); }));
    if (ids.size === 0) return;
    (async () => {
      const { data } = await supabase.from('regions').select('id, name, level').in('id', Array.from(ids));
      const rows = (data as Array<{ id: string; name: string; level: string }> | null) ?? [];
      if (rows.length === 0) return;
      setRegionMeta((prev) => {
        const next = { ...prev };
        rows.forEach((r) => { next[r.id] = { name: r.name, level: r.level }; });
        return next;
      });
    })();
  }, [history, regionMeta, supabase]);

  const toggle = (r: RegionRow) => {
    setRegionMeta((prev) => prev[r.id] ? prev : { ...prev, [r.id]: { name: r.name, level: r.level } });
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
      return next;
    });
  };
  const removeSelected = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleSubmit = async () => {
    setError(null);
    setResult(null);
    if (selected.size === 0) { setError('Pilih minimal satu wilayah'); return; }
    if (!message.trim()) { setError('Pesan wajib diisi'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regionIds: Array.from(selected), severity, message: message.trim() }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'Gagal mengirim broadcast'); return; }
      setResult({ recipients: j.recipients ?? 0, pushed: j.pushed ?? 0, usedFallback: j.usedFallback });
      setMessage('');
      setSelected(new Set());
      fetchHistory();
    } catch {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><WaveLoader size={48} /></div>;
  }

  const regionName = (id: string) => regionMeta[id]?.name ?? id.slice(0, 8);

  return (
    <>
      <style>{`
        .broadcast-page { padding: 1rem; max-width: 760px; margin: 0 auto; padding-bottom: 88px; overflow-y: auto; height: 100%; }
        .broadcast-grid { display: flex; flex-direction: column; gap: 1.25rem; }
        .broadcast-regions { max-height: 180px; }
        @media (min-width: 1024px) {
          .broadcast-page { max-width: 1080px; padding: 1.5rem; }
          .broadcast-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 1.5rem; align-items: start; }
          .broadcast-history { position: sticky; top: 0; }
          .broadcast-regions { max-height: 260px; }
        }
      `}</style>
      <div className="broadcast-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <Radio size={20} color="var(--primary-400)" />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Broadcast Peringatan</h1>
      </div>

      <div className="broadcast-grid">
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Severity */}
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Tingkat Peringatan</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {SEVERITY_OPTIONS.map((s) => {
              const active = severity === s.value;
              return (
                <button
                  key={s.value} type="button" onClick={() => setSeverity(s.value)}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                    padding: '0.625rem', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    background: active ? `${s.color}1f` : 'var(--bg-elevated)',
                    border: `1px solid ${active ? s.color : 'var(--border-primary)'}`,
                    color: active ? s.color : 'var(--text-secondary)', fontWeight: active ? 700 : 500, fontSize: '0.75rem',
                  }}
                >
                  <s.icon size={18} color={active ? s.color : 'var(--text-muted)'} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Region multi-select */}
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
            Wilayah Target {selected.size > 0 && <span style={{ color: 'var(--primary-400)' }}>({selected.size})</span>}
          </p>
          {/* Chip wilayah terpilih */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
              {Array.from(selected).map((id) => (
                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--primary-500)', color: '#fff', borderRadius: '999px' }}>
                  <MapPin size={11} />
                  {regionName(id)}
                  <button type="button" onClick={() => removeSelected(id)} style={{ display: 'flex', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#fff', opacity: 0.85 }}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari provinsi / kabupaten / kecamatan…"
              style={{
                width: '100%', padding: '0.5rem 0.625rem 0.5rem 2rem', fontSize: '0.8125rem',
                background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
              }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Hasil pencarian */}
          {search.trim().length >= 2 && (
            <div className="broadcast-regions" style={{ overflowY: 'auto', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', padding: '0.5rem', marginTop: '0.5rem' }}>
              {searching ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Loader2 size={12} className="animate-spin" /> Mencari…</p>
              ) : searchResults.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.5rem' }}>Tidak ada wilayah cocok.</p>
              ) : (
                searchResults.map((r) => {
                  const checked = selected.has(r.id);
                  return (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.4rem', cursor: 'pointer', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', background: checked ? 'var(--bg-elevated)' : 'transparent' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(r)} style={{ accentColor: 'var(--primary-500)', cursor: 'pointer' }} />
                      <MapPin size={12} color="var(--text-muted)" />
                      <span style={{ flex: 1 }}>{r.name}</span>
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.level}</span>
                    </label>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Message */}
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Pesan</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
            placeholder="Contoh: Waspada potensi banjir di wilayah Anda dalam 6 jam ke depan. Hindari area rendah."
            rows={4}
            style={{
              width: '100%', padding: '0.625rem', fontSize: '0.8125rem', resize: 'vertical',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
            }}
          />
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '0.25rem' }}>{message.length}/{MAX_LEN}</p>
        </div>

        {error && (
          <p style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>{error}</p>
        )}
        {result && (
          <div style={{ fontSize: '0.75rem', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
            <CheckCircle2 size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>
              Broadcast terkirim ke {result.recipients} pengguna ({result.pushed} push terkirim).
              {result.usedFallback && (
                <span style={{ display: 'block', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Wilayah terpilih belum memiliki pengguna terdaftar — peringatan dikirim ke seluruh pengguna.
                </span>
              )}
            </span>
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary" style={{ width: '100%' }}>
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Mengirim…</> : <><Send size={16} /> Kirim Broadcast</>}
        </button>
      </div>

      {/* History */}
      <div className="broadcast-history">
        <h2 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem' }}>Riwayat Broadcast</h2>
        {history.length === 0 ? (
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <Radio size={24} color="var(--text-muted)" style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Belum ada broadcast.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {history.map((b) => {
              const sev = SEVERITY_OPTIONS.find((s) => s.value === b.severity_level)!;
              const expired = new Date(b.expires_at) < new Date();
              return (
                <div key={b.id} className="card" style={{ padding: '0.75rem 0.875rem', borderLeft: `3px solid ${sev.color}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                    <sev.icon size={14} color={sev.color} />
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: sev.color, textTransform: 'uppercase' }}>{sev.label}</span>
                    {expired || !b.is_active ? (
                      <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '1px 6px', borderRadius: 4, marginLeft: 'auto' }}>BERAKHIR</span>
                    ) : (
                      <span style={{ fontSize: '0.5625rem', color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '1px 6px', borderRadius: 4, marginLeft: 'auto' }}>AKTIF</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.8125rem', marginBottom: '0.35rem' }}>{b.message}</p>
                  <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
                    {b.target_regions.map(regionName).join(', ')} · {new Date(b.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
      </div>
    </>
  );
}
