'use client';

/**
 * FR-026 — Distribusi Status & Tingkat Keparahan
 *
 * Donut chart komposisi status laporan + bar chart tingkat keparahan.
 * Mengonsumsi agregasi dari dashboard (label + value + warna).
 */

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

export interface Slice {
  name: string;
  value: number;
  color: string;
}

const tooltipStyle = {
  background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
  borderRadius: 8, fontSize: 12, color: 'var(--text-primary)',
};

function Empty() {
  return (
    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
      Tidak ada data.
    </p>
  );
}

export function StatusDonut({ data }: { data: Slice[] }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return <Empty />;
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={filtered} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="none">
            {filtered.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem 0.875rem', marginTop: '0.25rem' }}>
        {filtered.map((d) => (
          <span key={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', color: 'var(--text-secondary)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color }} />
            {d.name} ({d.value})
          </span>
        ))}
      </div>
    </div>
  );
}

export function SeverityBars({ data }: { data: Slice[] }) {
  if (data.every((d) => d.value === 0)) return <Empty />;
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" name="Laporan" radius={[4, 4, 0, 0]}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
