'use client';

/**
 * FR-054 (PBI-29) — Editor Boundary Wilayah
 *
 * Modal peta Leaflet untuk menggambar / menempel (paste GeoJSON) boundary wilayah:
 * klik peta menambah titik poligon, simpan ke regions.boundary (PostGIS) via API.
 * Boundary dipakai trigger auto_assign_region sehingga laporan baru otomatis
 * ter-tag wilayah berdasarkan lokasi.
 */

import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
import { X, Undo2, Trash2, Save, Loader2, MapPinned, ClipboardPaste, Pencil } from 'lucide-react';

type LatLng = [number, number];
interface Geometry { type: string; coordinates: number[][][] | number[][][][] }

const INDONESIA: LatLng = [-2.5, 118];

function geomToPoints(geom: Geometry | null): LatLng[] {
  if (!geom) return [];
  try {
    let ring: number[][] | undefined;
    if (geom.type === 'Polygon') ring = (geom.coordinates as number[][][])[0];
    else if (geom.type === 'MultiPolygon') ring = (geom.coordinates as number[][][][])[0][0];
    if (!ring) return [];
    const pts = ring.map(([lng, lat]) => [lat, lng] as LatLng);
    // buang titik penutup (sama dengan titik awal)
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
    return pts;
  } catch { return []; }
}

function ClickCapture({ onAdd }: { onAdd: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onAdd([e.latlng.lat, e.latlng.lng]) });
  return null;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      try { map.fitBounds(points as [number, number][], { padding: [30, 30] }); } catch { /* abaikan */ }
    }
  }, [points, map]);
  return null;
}

// Perbaiki ukuran peta yang dirender di dalam modal (tile kepotong tanpa ini).
// ResizeObserver menangkap saat container mendapat ukuran final → invalidateSize.
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false });
    const ro = new ResizeObserver(fix);
    ro.observe(map.getContainer());
    const timers = [50, 200, 500, 900].map((d) => window.setTimeout(fix, d));
    return () => { ro.disconnect(); timers.forEach((t) => clearTimeout(t)); };
  }, [map]);
  return null;
}

// Pusatkan peta ke koordinat hasil geocode (hanya bila belum ada boundary).
function Recenter({ center, zoom, active }: { center: LatLng; zoom: number; active: boolean }) {
  const map = useMap();
  useEffect(() => { if (active) map.setView(center, zoom); }, [center, zoom, active, map]);
  return null;
}

export default function RegionBoundaryEditor({
  region,
  onClose,
}: {
  region: { id: string; name: string; parentName?: string };
  onClose: () => void;
}) {
  const [points, setPoints] = useState<LatLng[]>([]);
  const [rawGeoJSON, setRawGeoJSON] = useState<Geometry | null>(null); // simpan MultiPolygon utuh bila di-paste
  const [initialPoints, setInitialPoints] = useState<LatLng[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [center, setCenter] = useState<LatLng>(INDONESIA);
  const [zoom, setZoom] = useState(5);
  const [mapReady, setMapReady] = useState(false);

  // Tunda mount peta hingga modal & container benar-benar stabil → cegah tile kepotong
  // (Leaflet menghitung ukuran salah bila di-init saat container belum final).
  useEffect(() => {
    if (loading) { setMapReady(false); return; }
    const t = setTimeout(() => setMapReady(true), 250);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/regions/${region.id}/boundary`);
        const j = await res.json();
        if (res.ok && j.geojson) {
          const pts = geomToPoints(j.geojson);
          setPoints(pts);
          setInitialPoints(pts);
          if (j.geojson.type === 'MultiPolygon') setRawGeoJSON(j.geojson);
        } else {
          // Belum ada boundary → geocode nama wilayah agar peta terpusat ke wilayah ini
          // (bukan selalu di center Indonesia yang sama untuk semua region).
          try {
            const q = [region.name, region.parentName, 'Indonesia'].filter(Boolean).join(', ');
            const g = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
            const arr = await g.json();
            if (Array.isArray(arr) && arr[0]) { setCenter([parseFloat(arr[0].lat), parseFloat(arr[0].lon)]); setZoom(12); }
          } catch { /* abaikan */ }
        }
      } catch { /* abaikan */ } finally { setLoading(false); }
    })();
  }, [region.id, region.name, region.parentName]);

  const addPoint = useCallback((p: LatLng) => { setRawGeoJSON(null); setMsg(null); setPoints((prev) => [...prev, p]); }, []);
  const undo = () => { setRawGeoJSON(null); setPoints((prev) => prev.slice(0, -1)); };
  const reset = () => { setRawGeoJSON(null); setPoints([]); };

  const applyPaste = () => {
    setError(null);
    try {
      let g = JSON.parse(pasteText);
      if (g.type === 'Feature') g = g.geometry;
      if (g.type === 'FeatureCollection') g = g.features?.[0]?.geometry;
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) {
        setError('GeoJSON harus Polygon/MultiPolygon (atau Feature dengannya).'); return;
      }
      setPoints(geomToPoints(g));
      setRawGeoJSON(g.type === 'MultiPolygon' ? g : null);
      setShowPaste(false);
      setMsg('GeoJSON diterapkan ke peta. Klik Simpan untuk menyimpan.');
    } catch { setError('Teks bukan JSON yang valid.'); }
  };

  const buildGeoJSON = (): Geometry | null => {
    if (rawGeoJSON) return rawGeoJSON;
    if (points.length < 3) return null;
    const ring = points.map(([lat, lng]) => [lng, lat]);
    ring.push(ring[0]); // tutup ring
    return { type: 'Polygon', coordinates: [ring] };
  };

  const save = async () => {
    setError(null); setMsg(null);
    const geojson = buildGeoJSON();
    if (!geojson) { setError('Butuh minimal 3 titik untuk membentuk area.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/regions/${region.id}/boundary`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geojson }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'Gagal menyimpan boundary'); return; }
      setMsg('Boundary tersimpan.');
      setInitialPoints(points);
    } catch { setError('Kesalahan jaringan.'); } finally { setSaving(false); }
  };

  const clearBoundary = async () => {
    if (!confirm(`Hapus boundary "${region.name}"?`)) return;
    setSaving(true); setError(null); setMsg(null);
    try {
      const res = await fetch(`/api/admin/regions/${region.id}/boundary`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ geojson: null }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'Gagal menghapus boundary'); return; }
      setPoints([]); setRawGeoJSON(null); setInitialPoints([]);
      setMsg('Boundary dihapus.');
    } catch { setError('Kesalahan jaringan.'); } finally { setSaving(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: '720px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', maxHeight: '92vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPinned size={18} color="var(--primary-400)" />
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Boundary — {region.name}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={18} color="var(--text-muted)" /></button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
          Klik peta untuk menambah titik poligon, atau tempel GeoJSON. Boundary membuat laporan baru otomatis ter-tag ke wilayah ini.
        </p>

        <div style={{ height: '360px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-primary)', position: 'relative' }}>
          {!mapReady ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <Loader2 size={16} className="animate-spin" /> Memuat…
            </div>
          ) : (
            <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <InvalidateSize />
              <Recenter center={center} zoom={zoom} active={initialPoints.length === 0} />
              <ClickCapture onAdd={addPoint} />
              <FitBounds points={initialPoints} />
              {points.length >= 3 ? (
                <Polygon positions={points} pathOptions={{ color: '#3b82f6', fillOpacity: 0.2 }} />
              ) : points.length === 2 ? (
                <Polyline positions={points} pathOptions={{ color: '#3b82f6' }} />
              ) : null}
              {points.map((p, i) => (
                <CircleMarker key={i} center={p} radius={4} pathOptions={{ color: '#1d4ed8', fillColor: '#fff', fillOpacity: 1 }} />
              ))}
            </MapContainer>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>{points.length} titik{rawGeoJSON ? ' (MultiPolygon)' : ''}</span>
          <button onClick={undo} disabled={points.length === 0} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem', gap: '0.3rem' }}><Undo2 size={13} /> Undo</button>
          <button onClick={reset} disabled={points.length === 0} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem', gap: '0.3rem' }}><Pencil size={13} /> Reset</button>
          <button onClick={() => { setShowPaste((v) => !v); setError(null); }} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem', gap: '0.3rem' }}><ClipboardPaste size={13} /> Paste GeoJSON</button>
          <button onClick={clearBoundary} disabled={saving} className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.3rem 0.55rem', gap: '0.3rem', color: '#ef4444', marginLeft: 'auto' }}><Trash2 size={13} /> Hapus Boundary</button>
        </div>

        {showPaste && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <textarea
              value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={3}
              placeholder='{"type":"Polygon","coordinates":[[[lng,lat],...]]}'
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.6875rem', fontFamily: 'monospace', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)', resize: 'vertical' }}
            />
            <button onClick={applyPaste} className="btn btn-secondary" style={{ fontSize: '0.75rem', alignSelf: 'flex-start' }}>Terapkan ke peta</button>
          </div>
        )}

        {error && <p style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', margin: 0 }}>{error}</p>}
        {msg && <p style={{ fontSize: '0.75rem', color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', margin: 0 }}>{msg}</p>}

        <button onClick={save} disabled={saving || loading} className="btn btn-primary" style={{ width: '100%' }}>
          {saving ? <><Loader2 size={16} className="animate-spin" /> Menyimpan…</> : <><Save size={16} /> Simpan Boundary</>}
        </button>
      </div>
    </div>
  );
}
