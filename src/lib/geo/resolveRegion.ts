/**
 * FR-020 — Resolusi region_id dari koordinat laporan.
 *
 * Karena tabel regions tidak menyimpan boundary PostGIS, region_id ditentukan
 * via reverse-geocoding Nominatim (provinsi → kabupaten/kota → kecamatan) lalu
 * dicocokkan ke tabel regions berdasarkan nama. Best-effort: mengembalikan
 * region paling spesifik yang cocok, atau null bila gagal (tidak memblokir submit).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface NomAddress {
  state?: string;
  city?: string;
  county?: string;
  municipality?: string;
  city_district?: string;
  suburb?: string;
  town?: string;
  village?: string;
}

interface NamedRegion { id: string; name: string }

/** Normalisasi nama wilayah: buang prefix administratif + lowercase. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/^(kota administrasi|kota|kabupaten|kab\.?|kecamatan|kec\.?|daerah istimewa|provinsi)\s+/i, '')
    .trim();
}

function bestMatch(candidates: NamedRegion[], target: string): NamedRegion | null {
  const t = norm(target);
  if (!t) return null;
  // 1. exact (ternormalisasi)
  let m = candidates.find((c) => norm(c.name) === t);
  if (m) return m;
  // 2. saling-mengandung
  m = candidates.find((c) => { const n = norm(c.name); return n.includes(t) || t.includes(n); });
  return m ?? null;
}

export async function resolveRegionId(
  supabase: SupabaseClient,
  lat: number,
  lng: number
): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=id`;
    const res = await fetch(url, { headers: { 'User-Agent': 'FloodSense/1.0 (flood-reporting)' } });
    if (!res.ok) return null;
    const data = await res.json();
    const a: NomAddress = data?.address ?? {};

    const provName = a.state;
    const kabName = a.city || a.county || a.municipality;
    const kecName = a.city_district || a.suburb || a.town || a.village;
    if (!provName) return null;

    // Provinsi
    const { data: provs } = await supabase.from('regions').select('id, name').eq('level', 'provinsi');
    const prov = bestMatch((provs as NamedRegion[] | null) ?? [], provName);
    if (!prov) return null;
    let regionId = prov.id;

    // Kabupaten/Kota
    if (kabName) {
      const { data: kabs } = await supabase.from('regions').select('id, name').eq('level', 'kabupaten').eq('parent_id', prov.id);
      const kab = bestMatch((kabs as NamedRegion[] | null) ?? [], kabName);
      if (kab) {
        regionId = kab.id;
        // Kecamatan
        if (kecName) {
          const { data: kecs } = await supabase.from('regions').select('id, name').eq('level', 'kecamatan').eq('parent_id', kab.id);
          const kec = bestMatch((kecs as NamedRegion[] | null) ?? [], kecName);
          if (kec) regionId = kec.id;
        }
      }
    }
    return regionId;
  } catch {
    return null;
  }
}
