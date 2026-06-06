'use client';

/**
 * FR-058 (PBI-33) — Preferensi Notifikasi Lanjutan
 *
 * Mengatur jenis notifikasi yang ingin diterima (5 tipe) dan jam tenang
 * (quiet hours). Disimpan ke tabel notification_preferences (upsert per user).
 * Enforcement saat kirim push ada di /api/push/send.
 */

import { useEffect, useState, useCallback } from 'react';
import { BellRing, Moon, Loader2, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

type ToggleKey = 'status_change' | 'report_verified' | 'report_rejected' | 'broadcast' | 'area_status_update';

interface Prefs {
  status_change: boolean;
  report_verified: boolean;
  report_rejected: boolean;
  broadcast: boolean;
  area_status_update: boolean;
  quiet_start: number | null;
  quiet_end: number | null;
}

const DEFAULTS: Prefs = {
  status_change: true, report_verified: true, report_rejected: true,
  broadcast: true, area_status_update: true, quiet_start: null, quiet_end: null,
};

const TYPES: Array<{ key: ToggleKey; label: string; desc: string }> = [
  { key: 'broadcast', label: 'Peringatan Broadcast', desc: 'Peringatan banjir dari TLM' },
  { key: 'report_verified', label: 'Laporan Terverifikasi', desc: 'Saat laporan Anda diverifikasi' },
  { key: 'report_rejected', label: 'Laporan Ditolak', desc: 'Saat laporan Anda ditolak' },
  { key: 'status_change', label: 'Perubahan Status & Komentar', desc: 'Update status / komentar laporan' },
  { key: 'area_status_update', label: 'Status Area', desc: 'Perubahan status wilayah pantauan' },
];

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      style={{
        width: '40px', height: '23px', borderRadius: '999px', flexShrink: 0, cursor: 'pointer',
        background: on ? 'var(--primary-500)' : 'var(--bg-elevated)',
        border: `1px solid ${on ? 'var(--primary-400)' : 'var(--border-primary)'}`,
        position: 'relative', transition: 'background var(--transition-fast)', padding: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '2px', left: on ? '19px' : '2px',
        width: '17px', height: '17px', borderRadius: '50%', background: '#fff',
        transition: 'left var(--transition-fast)',
      }} />
    </button>
  );
}

export default function NotificationPreferences() {
  const supabase = createClient();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notification_preferences')
      .select('status_change, report_verified, report_rejected, broadcast, area_status_update, quiet_start, quiet_end')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setPrefs({ ...DEFAULTS, ...(data as Partial<Prefs>) });
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const persist = useCallback(async (next: Prefs) => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    setSaving(false);
    if (!error) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
  }, [supabase, user]);

  const toggle = (key: ToggleKey) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    persist(next);
  };

  const setQuiet = (field: 'quiet_start' | 'quiet_end', value: string) => {
    const next = { ...prefs, [field]: value === '' ? null : Number(value) };
    setPrefs(next);
    persist(next);
  };

  const quietOn = prefs.quiet_start !== null && prefs.quiet_end !== null;

  if (loading) {
    return (
      <div className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={18} className="animate-spin" color="var(--text-muted)" />
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
        <BellRing size={16} color="var(--primary-400)" />
        <p style={{ fontSize: '0.875rem', fontWeight: 700, flex: 1 }}>Jenis Notifikasi</p>
        {saving ? <Loader2 size={13} className="animate-spin" color="var(--text-muted)" />
          : saved ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.625rem', color: '#22c55e', fontWeight: 600 }}><Check size={11} /> Tersimpan</span>
          : null}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {TYPES.map((t) => (
          <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 500, margin: 0 }}>{t.label}</p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '1px 0 0' }}>{t.desc}</p>
            </div>
            <Toggle on={prefs[t.key]} onClick={() => toggle(t.key)} />
          </div>
        ))}
      </div>

      {/* Quiet hours */}
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Moon size={15} color="#8b5cf6" />
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, flex: 1 }}>Jam Tenang</p>
          <Toggle
            on={quietOn}
            onClick={() => {
              const next: Prefs = quietOn
                ? { ...prefs, quiet_start: null, quiet_end: null }
                : { ...prefs, quiet_start: 22, quiet_end: 6 };
              setPrefs(next); persist(next);
            }}
          />
        </div>
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: quietOn ? '0.625rem' : 0 }}>
          Push ditahan pada rentang jam ini (notifikasi darurat tetap masuk).
        </p>
        {quietOn && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HourSelect value={prefs.quiet_start} onChange={(v) => setQuiet('quiet_start', v)} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>sampai</span>
            <HourSelect value={prefs.quiet_end} onChange={(v) => setQuiet('quiet_end', v)} />
          </div>
        )}
      </div>
    </div>
  );
}

function HourSelect({ value, onChange }: { value: number | null; onChange: (v: string) => void }) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={{
        flex: 1, padding: '0.45rem', fontSize: '0.8125rem', cursor: 'pointer',
        background: 'var(--bg-elevated)', color: 'var(--text-primary)',
        border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
      }}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
      ))}
    </select>
  );
}
