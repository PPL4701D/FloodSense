'use client';

/**
 * FR-023 — CascadingRegionFilter (Provinsi → Kabupaten/Kota → Kecamatan)
 *
 * Lazy-load per level: hanya provinsi yang diambil saat mount; kabupaten & kecamatan
 * diambil on-demand saat induknya dipilih (menghindari memuat ribuan baris sekaligus).
 * onChange mengembalikan region_id paling spesifik yang dipilih (atau null).
 * Dipakai oleh dashboard (PBI-11/12/13) & daftar laporan (PBI-22).
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface RegionRow { id: string; name: string }

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem', fontSize: '0.8125rem',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
  appearance: 'none', cursor: 'pointer',
};

export default function RegionFilter({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (regionId: string | null) => void;
}) {
  const supabase = createClient();
  const [provinsi, setProvinsi] = useState<RegionRow[]>([]);
  const [kabupaten, setKabupaten] = useState<RegionRow[]>([]);
  const [kecamatan, setKecamatan] = useState<RegionRow[]>([]);
  const [prov, setProv] = useState<string>('');
  const [kab, setKab] = useState<string>('');
  const [kec, setKec] = useState<string>('');

  // Hanya provinsi yang dimuat di awal.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('regions').select('id, name').eq('level', 'provinsi').order('name');
      setProvinsi((data as RegionRow[] | null) ?? []);
    })();
  }, [supabase]);

  // Reset bila value di-clear dari luar.
  useEffect(() => {
    if (value === null) { setProv(''); setKab(''); setKec(''); setKabupaten([]); setKecamatan([]); }
  }, [value]);

  const loadChildren = useCallback(async (parentId: string, level: 'kabupaten' | 'kecamatan') => {
    const { data } = await supabase.from('regions').select('id, name').eq('parent_id', parentId).eq('level', level).order('name');
    return (data as RegionRow[] | null) ?? [];
  }, [supabase]);

  const emit = (p: string, k: string, c: string) => onChange(c || k || p || null);

  const onProv = async (v: string) => {
    setProv(v); setKab(''); setKec(''); setKabupaten([]); setKecamatan([]);
    emit(v, '', '');
    if (v) setKabupaten(await loadChildren(v, 'kabupaten'));
  };
  const onKab = async (v: string) => {
    setKab(v); setKec(''); setKecamatan([]);
    emit(prov, v, '');
    if (v) setKecamatan(await loadChildren(v, 'kecamatan'));
  };
  const onKec = (v: string) => { setKec(v); emit(prov, kab, v); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <select style={selectStyle} value={prov} onChange={(e) => onProv(e.target.value)}>
        <option value="">Semua Provinsi</option>
        {provinsi.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>

      {prov && kabupaten.length > 0 && (
        <select style={selectStyle} value={kab} onChange={(e) => onKab(e.target.value)}>
          <option value="">Semua Kabupaten/Kota</option>
          {kabupaten.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}

      {kab && kecamatan.length > 0 && (
        <select style={selectStyle} value={kec} onChange={(e) => onKec(e.target.value)}>
          <option value="">Semua Kecamatan</option>
          {kecamatan.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
    </div>
  );
}
