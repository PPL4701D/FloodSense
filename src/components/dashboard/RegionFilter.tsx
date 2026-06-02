'use client';

/**
 * FR-023 — CascadingRegionFilter (Provinsi → Kabupaten → Kecamatan)
 *
 * Dropdown bertingkat berdasarkan tabel regions (level + parent_id).
 * onChange mengembalikan region_id paling spesifik yang dipilih (atau null).
 * Dipakai ulang oleh dashboard (PBI-11/12/13) & daftar laporan (PBI-22).
 */

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RegionLevel } from '@/types/database';

interface RegionRow {
  id: string;
  name: string;
  level: RegionLevel;
  parent_id: string | null;
}

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
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [prov, setProv] = useState<string>('');
  const [kab, setKab] = useState<string>('');
  const [kec, setKec] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('regions').select('id, name, level, parent_id').order('name');
      setRegions((data as RegionRow[] | null) ?? []);
    })();
  }, [supabase]);

  // Reset internal state bila value di-clear dari luar
  useEffect(() => {
    if (value === null) { setProv(''); setKab(''); setKec(''); }
  }, [value]);

  const provinsi = useMemo(() => regions.filter((r) => r.level === 'provinsi'), [regions]);
  const kabupaten = useMemo(() => regions.filter((r) => r.level === 'kabupaten' && r.parent_id === prov), [regions, prov]);
  const kecamatan = useMemo(() => regions.filter((r) => r.level === 'kecamatan' && r.parent_id === kab), [regions, kab]);

  const emit = (p: string, k: string, c: string) => onChange(c || k || p || null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <select
        style={selectStyle}
        value={prov}
        onChange={(e) => { const v = e.target.value; setProv(v); setKab(''); setKec(''); emit(v, '', ''); }}
      >
        <option value="">Semua Provinsi</option>
        {provinsi.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>

      {prov && kabupaten.length > 0 && (
        <select
          style={selectStyle}
          value={kab}
          onChange={(e) => { const v = e.target.value; setKab(v); setKec(''); emit(prov, v, ''); }}
        >
          <option value="">Semua Kabupaten/Kota</option>
          {kabupaten.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}

      {kab && kecamatan.length > 0 && (
        <select
          style={selectStyle}
          value={kec}
          onChange={(e) => { const v = e.target.value; setKec(v); emit(prov, kab, v); }}
        >
          <option value="">Semua Kecamatan</option>
          {kecamatan.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
    </div>
  );
}
