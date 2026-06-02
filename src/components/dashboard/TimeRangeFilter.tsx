'use client';

/**
 * FR-024 — DateRangePicker dengan preset (7 hari, 30 hari, custom).
 * onChange mengembalikan { from, to } ISO date (yyyy-mm-dd) atau null.
 */

import { useState } from 'react';

export type TimeRange = { preset: '7d' | '30d' | 'custom'; from: string; to: string };

const btn = (active: boolean): React.CSSProperties => ({
  padding: '0.4rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
  background: active ? 'var(--primary-500)' : 'var(--bg-elevated)',
  color: active ? '#fff' : 'var(--text-secondary)',
  border: `1px solid ${active ? 'var(--primary-400)' : 'var(--border-primary)'}`,
});

function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

export default function TimeRangeFilter({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
}) {
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button style={btn(value.preset === '7d')} onClick={() => onChange({ preset: '7d', from: daysAgoISO(7), to: today })}>7 hari</button>
        <button style={btn(value.preset === '30d')} onClick={() => onChange({ preset: '30d', from: daysAgoISO(30), to: today })}>30 hari</button>
        <button style={btn(value.preset === 'custom')} onClick={() => onChange({ preset: 'custom', from, to })}>Custom</button>
      </div>
      {value.preset === 'custom' && (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input type="date" className="input" style={{ width: 'auto' }} value={from} max={to || today}
            onChange={(e) => { setFrom(e.target.value); onChange({ preset: 'custom', from: e.target.value, to }); }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
          <input type="date" className="input" style={{ width: 'auto' }} value={to} min={from} max={today}
            onChange={(e) => { setTo(e.target.value); onChange({ preset: 'custom', from, to: e.target.value }); }} />
        </div>
      )}
    </div>
  );
}
