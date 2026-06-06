import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { SeverityLevel, ReportStatus } from '@/types/database';

/**
 * FR-021 (PBI-10) — Deteksi Duplikasi/Spam: Cluster Laporan Berdekatan
 *
 * GET /api/admin/duplicate-clusters (staf/tlm/admin)
 * Mengelompokkan laporan 7 hari terakhir berdasarkan kedekatan lokasi (~200 m)
 * secara live (greedy clustering). Cluster berisi >= 2 laporan ditandai sebagai
 * potensi duplikat/spam untuk ditinjau staf. Melengkapi rate-limit & dedup yang
 * sudah ada di /api/reports/submit.
 */

interface Row { id: string; lat: number; lng: number; severity: SeverityLevel; status: ReportStatus; created_at: string; description: string | null; region_id: string | null }
interface Cluster {
  lat: number; lng: number; count: number; reports: Row[];
  reporters?: number;
}

const RADIUS_M = 200;

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['staf', 'tlm', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error: rpcErr } = await supabase.rpc('get_map_reports', { p_since: since, p_severity: null, p_status: null });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });

    const rows = ((data as Row[] | null) ?? []).filter((r) => r.lat !== 0 && r.lng !== 0);

    // Greedy clustering berdasarkan jarak <= RADIUS_M
    const clusters: Cluster[] = [];
    for (const r of rows) {
      let placed = false;
      for (const c of clusters) {
        if (haversine(c.lat, c.lng, r.lat, r.lng) <= RADIUS_M) {
          c.reports.push(r);
          // update centroid (rata-rata sederhana)
          c.lat = (c.lat * c.count + r.lat) / (c.count + 1);
          c.lng = (c.lng * c.count + r.lng) / (c.count + 1);
          c.count += 1;
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push({ lat: r.lat, lng: r.lng, count: 1, reports: [r] });
    }

    // Hanya cluster dengan >= 2 laporan = potensi duplikat
    const dup = clusters
      .filter((c) => c.count >= 2)
      .map((c) => ({
        lat: c.lat, lng: c.lng, report_count: c.count,
        latest_at: c.reports.reduce((m, r) => (r.created_at > m ? r.created_at : m), c.reports[0].created_at),
        sample: c.reports[0].description,
        severity: c.reports[0].severity,
        report_ids: c.reports.map((r) => r.id),
      }))
      .sort((a, b) => b.report_count - a.report_count);

    return NextResponse.json({ clusters: dup, total_clusters: dup.length, total_reports_scanned: rows.length });
  } catch (err) {
    console.error('GET /api/admin/duplicate-clusters error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
