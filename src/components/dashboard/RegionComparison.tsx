'use client';

/**
 * FR-028 — Perbandingan Antar Wilayah
 *
 * Horizontal bar chart membandingkan wilayah (top-N) berdasarkan metrik yang
 * dipilih admin (jumlah laporan, rata-rata ketinggian, % terverifikasi, dll).
 * Mengonsumsi agregasi {name, value} + label/unit dari dashboard.
 */

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';

export interface RegionDatum {
  name: string;
  value: number;
}

const PALETTE = ['#3b82f6', '#0891b2', '#8b5cf6', '#22c55e', '#eab308', '#ef4444', '#f97316'];

export default function RegionComparison({
  data,
  valueLabel = 'Laporan',
  unit = '',
}: {
  data: RegionDatum[];
  valueLabel?: string;
  unit?: string;
}) {
  if (data.length === 0) {
    return (
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
        Belum ada laporan berwilayah pada filter ini.
      </p>
    );
  }

  const height = Math.max(160, data.length * 38);

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis
            type="category" dataKey="name" width={104}
            tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary)' }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(v: number | string) => [`${v}${unit}`, valueLabel]}
          />
          <Bar dataKey="value" name={valueLabel} radius={[0, 4, 4, 0]}>
            {data.map((d, i) => <Cell key={d.name} fill={PALETTE[i % PALETTE.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
