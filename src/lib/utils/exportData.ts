/**
 * FR-027 — Utilitas Ekspor Data (CSV & PDF)
 *
 * Helper murni untuk mengekspor baris laporan terfilter dari dashboard ke
 * berkas CSV (unduhan Blob, kompatibel Excel) maupun PDF (jsPDF + autotable,
 * orientasi landscape agar kolom detail muat). Tidak bergantung pada React.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportRow {
  no: number;
  tanggal: string;
  pelapor: string;
  status: string;
  keparahan: string;
  ketinggian: string;
  wilayah: string;
  alamat: string;
}

export interface ExportMeta {
  title: string;
  /** Deskripsi filter aktif, mis. "Wilayah: Bandung · 1–7 Jun 2026". */
  subtitle?: string;
}

const HEADERS: Array<{ key: keyof ExportRow; label: string; pdfWidth?: number }> = [
  { key: 'no', label: 'No', pdfWidth: 28 },
  { key: 'tanggal', label: 'Tanggal', pdfWidth: 95 },
  { key: 'pelapor', label: 'Pelapor', pdfWidth: 110 },
  { key: 'status', label: 'Status', pdfWidth: 80 },
  { key: 'keparahan', label: 'Keparahan', pdfWidth: 78 },
  { key: 'ketinggian', label: 'Tinggi (cm)', pdfWidth: 62 },
  { key: 'wilayah', label: 'Wilayah', pdfWidth: 110 },
  { key: 'alamat', label: 'Alamat', pdfWidth: 160 },
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function exportToCSV(rows: ExportRow[], baseName = 'laporan-floodsense'): void {
  const head = HEADERS.map((h) => h.label).join(',');
  const body = rows
    .map((r) => HEADERS.map((h) => csvEscape(String(r[h.key] ?? ''))).join(','))
    .join('\n');
  // BOM agar Excel membaca UTF-8 dengan benar.
  const blob = new Blob([`﻿${head}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${baseName}-${timestamp()}.csv`);
}

export function exportToPDF(rows: ExportRow[], meta: ExportMeta, baseName = 'laporan-floodsense'): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  doc.setFontSize(14);
  doc.text(meta.title, 40, 40);
  if (meta.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(meta.subtitle, 40, 56);
  }
  doc.setTextColor(150);
  doc.setFontSize(8);
  doc.text(`Diekspor: ${new Date().toLocaleString('id-ID')} · ${rows.length} laporan`, 40, meta.subtitle ? 70 : 56);

  const columnStyles: Record<number, { cellWidth: number }> = {};
  HEADERS.forEach((h, i) => { if (h.pdfWidth) columnStyles[i] = { cellWidth: h.pdfWidth }; });

  autoTable(doc, {
    startY: meta.subtitle ? 82 : 68,
    head: [HEADERS.map((h) => h.label)],
    body: rows.map((r) => HEADERS.map((h) => String(r[h.key] ?? ''))),
    styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles,
  });

  doc.save(`${baseName}-${timestamp()}.pdf`);
}
