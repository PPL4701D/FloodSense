'use client';

/**
 * FR-054 (PBI-29) — Manajemen Wilayah (Region CRUD) Admin
 *
 * Halaman /admin/regions (admin only). List wilayah + search + filter level,
 * form tambah/edit (nama, level, induk cascading, kode), hapus dengan guard
 * (dicegah bila punya anak/laporan), dan editor boundary (gambar/paste GeoJSON
 * di peta → regions.boundary PostGIS) via RegionBoundaryEditor.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/hooks/useAuth';
import WaveLoader from '@/components/ui/WaveLoader';
import { MapPinned, Plus, Pencil, Trash2, Search, X, Loader2, Save, Map, ChevronLeft } from 'lucide-react';
import type { RegionLevel } from '@/types/database';

const RegionBoundaryEditor = dynamic(() => import('@/components/admin/RegionBoundaryEditor'), { ssr: false });

interface RegionRow { id: string; name: string; level: RegionLevel; parent_id: string | null; code: string | null }

const LEVELS: RegionLevel[] = ['provinsi', 'kabupaten', 'kecamatan'];
const LEVEL_LABELS: Record<RegionLevel, string> = { provinsi: 'Provinsi', kabupaten: 'Kabupaten/Kota', kecamatan: 'Kecamatan' };
const LEVEL_COLORS: Record<RegionLevel, string> = { provinsi: '#3b82f6', kabupaten: '#8b5cf6', kecamatan: '#0891b2' };

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.625rem', fontSize: '0.8125rem',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
};

interface FormState { id: string | null; name: string; level: RegionLevel; parent_id: string; code: string }
const emptyForm: FormState = { id: null, name: '', level: 'provinsi', parent_id: '', code: '' };

export default function AdminRegionsPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();

  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<RegionLevel | 'all'>('all');
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boundaryRegion, setBoundaryRegion] = useState<{ id: string; name: string; parentName?: string } | null>(null);

  useEffect(() => {
    if (!authLoading && role !== 'admin') router.replace('/');
  }, [authLoading, role, router]);

  const fetchRegions = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/regions');
    const j = await res.json();
    if (res.ok) setRegions(j.regions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { if (role === 'admin') fetchRegions(); }, [role, fetchRegions]);

  const nameOf = useCallback((id: string | null) => (id ? regions.find((r) => r.id === id)?.name ?? '—' : '—'), [regions]);

  const filtered = useMemo(() => regions.filter((r) =>
    (levelFilter === 'all' || r.level === levelFilter) &&
    (!search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.code ?? '').toLowerCase().includes(search.toLowerCase()))
  ), [regions, levelFilter, search]);

  // Induk yang valid: satu level di atas yang dipilih
  const parentOptions = useMemo(() => {
    if (!form) return [];
    if (form.level === 'kabupaten') return regions.filter((r) => r.level === 'provinsi');
    if (form.level === 'kecamatan') return regions.filter((r) => r.level === 'kabupaten');
    return [];
  }, [form, regions]);

  const submit = async () => {
    if (!form) return;
    setError(null);
    if (!form.name.trim()) { setError('Nama wajib diisi'); return; }
    if (form.level !== 'provinsi' && !form.parent_id) { setError('Pilih wilayah induk'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), level: form.level, parent_id: form.parent_id || null, code: form.code.trim() || null };
      const res = form.id
        ? await fetch(`/api/admin/regions/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/regions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'Gagal menyimpan'); return; }
      setForm(null);
      fetchRegions();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: RegionRow) => {
    if (!confirm(`Hapus wilayah "${r.name}"?`)) return;
    const res = await fetch(`/api/admin/regions/${r.id}`, { method: 'DELETE' });
    const j = await res.json();
    if (!res.ok) { alert(j.error ?? 'Gagal menghapus'); return; }
    fetchRegions();
  };

  if (authLoading || (loading && regions.length === 0)) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><WaveLoader size={48} /></div>;
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '860px', margin: '0 auto', paddingBottom: '88px', overflowY: 'auto', height: '100%' }}>
      <button onClick={() => router.push('/admin')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '0.75rem' }}>
        <ChevronLeft size={16} /> Kembali ke Admin
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPinned size={20} color="var(--primary-400)" />
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Manajemen Wilayah</h1>
        </div>
        <button onClick={() => { setError(null); setForm({ ...emptyForm }); }} className="btn btn-primary" style={{ fontSize: '0.8125rem', gap: '0.35rem' }}>
          <Plus size={16} /> Tambah Wilayah
        </button>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: '0.75rem', marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / kode wilayah" style={{ ...inputStyle, paddingLeft: '2rem' }} />
        </div>
        <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as RegionLevel | 'all')} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
          <option value="all">Semua Level</option>
          {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
        </select>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem', padding: '2rem 0' }}>
            Tidak ada wilayah{search || levelFilter !== 'all' ? ' sesuai filter' : ''}.
          </p>
        ) : filtered.map((r) => (
          <div key={r.id} className="card" style={{ padding: '0.75rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: LEVEL_COLORS[r.level], background: `${LEVEL_COLORS[r.level]}1f`, border: `1px solid ${LEVEL_COLORS[r.level]}33`, padding: '2px 7px', borderRadius: '999px', textTransform: 'uppercase', flexShrink: 0 }}>
              {LEVEL_LABELS[r.level]}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>{r.name}</p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '1px 0 0' }}>
                {r.level !== 'provinsi' && <>Induk: {nameOf(r.parent_id)} · </>}{r.code ? `Kode: ${r.code}` : 'Tanpa kode'}
              </p>
            </div>
            <button onClick={() => setBoundaryRegion({ id: r.id, name: r.name, parentName: r.parent_id ? nameOf(r.parent_id) : undefined })} title="Boundary (peta)" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
              <Map size={15} color="var(--primary-400)" />
            </button>
            <button onClick={() => { setError(null); setForm({ id: r.id, name: r.name, level: r.level, parent_id: r.parent_id ?? '', code: r.code ?? '' }); }} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
              <Pencil size={15} color="var(--text-secondary)" />
            </button>
            <button onClick={() => remove(r)} title="Hapus" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
              <Trash2 size={15} color="#ef4444" />
            </button>
          </div>
        ))}
      </div>

      {/* Form modal */}
      {form && (
        <div onClick={() => !saving && setForm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: '420px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>{form.id ? 'Edit Wilayah' : 'Tambah Wilayah'}</h2>
              <button onClick={() => !saving && setForm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} color="var(--text-muted)" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Nama</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. Jawa Barat" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Level</label>
                <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as RegionLevel, parent_id: '' })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABELS[l]}</option>)}
                </select>
              </div>
              {form.level !== 'provinsi' && (
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Wilayah Induk</label>
                  <select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">— Pilih induk —</option>
                    {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Kode (opsional)</label>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="mis. 32" style={inputStyle} />
              </div>
              {error && <p style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>{error}</p>}
              <button onClick={submit} disabled={saving} className="btn btn-primary" style={{ width: '100%', marginTop: '0.25rem' }}>
                {saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan…</> : <><Save size={16} /> Simpan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {boundaryRegion && (
        <RegionBoundaryEditor region={boundaryRegion} onClose={() => setBoundaryRegion(null)} />
      )}
    </div>
  );
}
