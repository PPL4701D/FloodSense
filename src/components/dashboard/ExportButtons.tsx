'use client';

/**
 * FR-027 — Tombol Ekspor Data Dashboard
 *
 * Dua tombol (CSV & PDF) yang mengekspor baris laporan terfilter saat ini.
 * Nonaktif bila tidak ada data. Logika ekspor ada di lib/utils/exportData.
 */

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { exportToCSV, exportToPDF, type ExportRow, type ExportMeta } from '@/lib/utils/exportData';

interface ExportButtonsProps {
  rows: ExportRow[];
  meta: ExportMeta;
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  fontSize: '0.75rem', fontWeight: 600, padding: '0.45rem 0.75rem',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
};

export default function ExportButtons({ rows, meta }: ExportButtonsProps) {
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const disabled = rows.length === 0;

  const run = (kind: 'csv' | 'pdf') => {
    if (disabled || busy) return;
    setBusy(kind);
    try {
      if (kind === 'csv') exportToCSV(rows);
      else exportToPDF(rows, meta);
    } finally {
      // beri jeda kecil agar spinner terlihat untuk dataset besar
      setTimeout(() => setBusy(null), 300);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        <Download size={13} /> Ekspor
      </span>
      <button type="button" onClick={() => run('csv')} disabled={disabled || !!busy} style={{ ...btnStyle, opacity: disabled ? 0.5 : 1 }} title="Unduh CSV">
        {busy === 'csv' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} color="#22c55e" />} CSV
      </button>
      <button type="button" onClick={() => run('pdf')} disabled={disabled || !!busy} style={{ ...btnStyle, opacity: disabled ? 0.5 : 1 }} title="Unduh PDF">
        {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} color="#ef4444" />} PDF
      </button>
    </div>
  );
}
