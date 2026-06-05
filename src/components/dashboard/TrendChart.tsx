'use client';

/**
 * FR-025 — Grafik Tren Laporan
 *
 * Area chart jumlah laporan per hari (total + terverifikasi) pada rentang
 * waktu terpilih. Mengonsumsi series yang sudah diagregasi di dashboard.
 */

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

export interface TrendPoint {
  label: string;
  total: number;
  verified: number;
}

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
        Tidak ada data untuk ditampilkan.
      </p>
    );
  }

  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gVerified" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
              borderRadius: 8, fontSize: 12, color: 'var(--text-primary)',
            }}
            labelStyle={{ color: 'var(--text-secondary)' }}
          />
          <Area type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} fill="url(#gTotal)" />
          <Area type="monotone" dataKey="verified" name="Terverifikasi" stroke="#22c55e" strokeWidth={2} fill="url(#gVerified)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
