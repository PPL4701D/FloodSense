import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * FR-053 — Report Status Timeline
 *
 * Mengembalikan linimasa perjalanan status sebuah laporan untuk ditampilkan ke
 * pelapor. Verifikasi diproteksi RLS (hanya staf), jadi data diambil via admin
 * client lalu disajikan read-only ke pemilik laporan di halaman detail.
 */

type TimelineEvent = {
  key: string;
  label: string;
  at: string;
  note: string | null;
  kind: 'created' | 'scheduled_check' | 'verified' | 'rejected';
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: report, error: reportErr } = await admin
      .from('reports')
      .select('created_at, status, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (reportErr || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const { data: verifications, error: verErr } = await admin
      .from('verifications')
      .select('decision, notes, scheduled_check_at, created_at')
      .eq('report_id', id)
      .order('created_at', { ascending: true });

    if (verErr) {
      console.error('Timeline verifications error:', verErr);
      return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
    }

    const events: TimelineEvent[] = [
      {
        key: 'created',
        label: 'Laporan Dibuat',
        at: report.created_at,
        note: null,
        kind: 'created',
      },
    ];

    for (const v of verifications ?? []) {
      if (v.decision === 'scheduled_check') {
        events.push({
          key: `sched-${v.created_at}`,
          label: 'Dijadwalkan Pemeriksaan Ulang',
          at: v.created_at,
          note: v.notes || null,
          kind: 'scheduled_check',
        });
      } else if (v.decision === 'verified') {
        events.push({
          key: `ver-${v.created_at}`,
          label: 'Laporan Terverifikasi',
          at: v.created_at,
          note: v.notes || null,
          kind: 'verified',
        });
      } else if (v.decision === 'rejected') {
        events.push({
          key: `rej-${v.created_at}`,
          label: 'Laporan Ditolak',
          at: v.created_at,
          note: v.notes || null,
          kind: 'rejected',
        });
      }
    }

    // Fallback: jika status laporan sudah verified/rejected tapi tidak ada baris
    // verifikasi (mis. data lama / di-set langsung tanpa lewat panel staf),
    // tetap tampilkan event terminal agar linimasa konsisten dengan status.
    const hasTerminal = events.some((e) => e.kind === 'verified' || e.kind === 'rejected');
    if (!hasTerminal && (report.status === 'verified' || report.status === 'rejected')) {
      const at = (report as { updated_at?: string | null }).updated_at || report.created_at;
      events.push(
        report.status === 'verified'
          ? { key: 'status-verified', label: 'Laporan Terverifikasi', at, note: null, kind: 'verified' }
          : { key: 'status-rejected', label: 'Laporan Ditolak', at, note: null, kind: 'rejected' }
      );
    }

    return NextResponse.json({ status: report.status, events });
  } catch (error) {
    console.error('Timeline server error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
