'use client';

/**
 * FR-057 (PBI-32) — Time-lapse / Pemutaran Historis Heatmap
 *
 * Panel pemutar historis: mengambil laporan dalam rentang (24 jam / 7 hari),
 * lalu menganimasikan heatmap dari waktu ke waktu. Drag slider untuk melihat
 * kondisi pada titik waktu tertentu; Play untuk animasi otomatis (kecepatan
 * 1x/2x/4x). Saat aktif, heatmap memakai titik historis (override via store).
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, X, History, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMapStore } from '@/stores/mapStore';
import { SEVERITY_WEIGHTS } from '@/types/database';
import type { HeatmapPoint, SeverityLevel } from '@/types/database';

interface Frame { lat: number; lng: number; weight: number; t: number }

const WINDOWS = [
  { key: '24h', label: '24 Jam', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 Hari', ms: 7 * 24 * 60 * 60 * 1000 },
] as const;
const STEPS = 48;
const SPEEDS = [1, 2, 4] as const;

export default function TimelapseSlider({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const { setTimelapseActive, setTimelapsePoints } = useMapStore();

  const [windowKey, setWindowKey] = useState<'24h' | '7d'>('7d');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(STEPS);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(2);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const win = WINDOWS.find((w) => w.key === windowKey)!;
  const endMs = useRef(Date.now());
  const startMs = endMs.current - win.ms;
  const currentTime = startMs + (step / STEPS) * win.ms;

  // Aktifkan mode time-lapse di store saat mount; matikan saat unmount.
  useEffect(() => {
    setTimelapseActive(true);
    return () => {
      setTimelapseActive(false);
      setTimelapsePoints([]);
    };
  }, [setTimelapseActive, setTimelapsePoints]);

  // Ambil data saat window berubah.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPlaying(false);
      endMs.current = Date.now();
      const since = new Date(endMs.current - win.ms).toISOString();
      const { data } = await supabase.rpc('get_map_reports', { p_since: since, p_severity: null, p_status: null });
      if (cancelled) return;
      const rows = (data as Array<{ lat: number; lng: number; severity: SeverityLevel; created_at: string }> | null) ?? [];
      const fr: Frame[] = rows
        .filter((r) => r.lat !== 0 && r.lng !== 0)
        .map((r) => ({ lat: r.lat, lng: r.lng, weight: SEVERITY_WEIGHTS[r.severity], t: new Date(r.created_at).getTime() }));
      setFrames(fr);
      setStep(STEPS);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [supabase, win.ms]);

  // Hitung & kirim titik heatmap untuk step saat ini.
  useEffect(() => {
    const pts: HeatmapPoint[] = frames
      .filter((f) => f.t <= currentTime)
      .map((f) => [f.lat, f.lng, f.weight] as HeatmapPoint);
    setTimelapsePoints(pts);
  }, [frames, currentTime, setTimelapsePoints]);

  // Animasi play.
  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setStep((s) => {
        if (s >= STEPS) { setPlaying(false); return STEPS; }
        return s + 1;
      });
    }, 600 / speed);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speed]);

  const togglePlay = useCallback(() => {
    setStep((s) => (s >= STEPS ? 0 : s)); // mulai dari awal bila di ujung
    setPlaying((p) => !p);
  }, []);

  const reset = useCallback(() => { setPlaying(false); setStep(0); }, []);

  const activeCount = frames.filter((f) => f.t <= currentTime).length;
  const timeLabel = new Date(currentTime).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div
      className="glass"
      style={{
        position: 'absolute', bottom: 'calc(104px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
        zIndex: 1200, width: 'min(440px, calc(100vw - 32px))', padding: '0.875rem 1rem',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-primary)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
        <History size={15} color="var(--primary-400)" />
        <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Time-lapse Banjir</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              style={{
                fontSize: '0.625rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', cursor: 'pointer',
                background: windowKey === w.key ? 'var(--primary-500)' : 'var(--bg-elevated)',
                color: windowKey === w.key ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${windowKey === w.key ? 'var(--primary-400)' : 'var(--border-primary)'}`,
              }}
            >
              {w.label}
            </button>
          ))}
          <button onClick={onClose} title="Tutup" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '2px', marginLeft: '2px' }}>
            <X size={15} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          <Loader2 size={14} className="animate-spin" /> Memuat data historis…
        </div>
      ) : frames.length === 0 ? (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem 0' }}>
          Tidak ada laporan pada rentang ini.
        </p>
      ) : (
        <>
          {/* Time label + count */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary-400)' }}>{timeLabel}</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{activeCount} laporan</span>
          </div>

          {/* Slider */}
          <input
            type="range" min={0} max={STEPS} value={step}
            onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }}
            style={{ width: '100%', accentColor: 'var(--primary-500)', cursor: 'pointer' }}
          />

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={togglePlay} className="btn btn-primary" style={{ padding: '0.4rem 0.875rem', fontSize: '0.75rem', gap: '0.35rem' }}>
              {playing ? <><Pause size={14} /> Jeda</> : <><Play size={14} /> Putar</>}
            </button>
            <button onClick={reset} title="Ulang" className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}>
              <RotateCcw size={14} />
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  style={{
                    fontSize: '0.6875rem', fontWeight: 700, padding: '3px 7px', borderRadius: '6px', cursor: 'pointer',
                    background: speed === s ? 'var(--primary-500)' : 'var(--bg-elevated)',
                    color: speed === s ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${speed === s ? 'var(--primary-400)' : 'var(--border-primary)'}`,
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
