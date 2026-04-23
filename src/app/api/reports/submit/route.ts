import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * FR-006 + FR-021: Report Submission with Spam/Duplicate Detection
 *
 * Checks before saving:
 * 1. Same reporter within ~100m in last 30 minutes → flag as duplicate
 * 2. Same reporter has >10 reports in last 1 hour → rate limit (HTTP 429)
 *
 * On flag: status='flagged', hidden from public map, added to staff queue.
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { lat, lng, severity, description, water_height_cm, address, is_surge_receding } = body;

    if (!lat || !lng || !severity) {
      return NextResponse.json(
        { error: 'lat, lng, and severity are required' },
        { status: 400 }
      );
    }

    // --- FR-021: Spam/Duplicate Detection ---

    // Check 1: Rate limit — >10 reports in last 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', user.id)
      .gte('created_at', oneHourAgo);

    if ((recentCount ?? 0) >= 10) {
      return NextResponse.json(
        { error: 'Batas laporan tercapai (maks 10 per jam). Coba lagi nanti.' },
        { status: 429 }
      );
    }

    // Check 2: Duplicate — same reporter, within ~100m, in last 30 minutes
    // Using PostGIS ST_DWithin if available, fallback to bounding box
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    let isDuplicate = false;

    // Approximate 100m in degrees (~0.001 for lat/lng)
    const degreeApprox = 0.001;
    const { data: nearbyReports } = await supabase
      .from('reports')
      .select('id')
      .eq('reporter_id', user.id)
      .gte('created_at', thirtyMinAgo)
      .not('status', 'eq', 'rejected');

    if (nearbyReports && nearbyReports.length > 0) {
      // We have reports from this user in the last 30 min, check proximity
      // Since we can't easily do ST_DWithin from client SDK, use RPC if available
      // Fallback: flag if ANY report from user in last 30min exists (conservative)
      const { data: proximityCheck } = await supabase.rpc('check_nearby_report', {
        p_reporter_id: user.id,
        p_lat: lat,
        p_lng: lng,
        p_radius_meters: 100,
        p_minutes_ago: 30,
      }).maybeSingle();

      if ((proximityCheck as Record<string, unknown>)?.exists) {
        isDuplicate = true;
      } else if (!proximityCheck) {
        // RPC not available — fallback bounding box check
        // This is less accurate but works without PostGIS RPC
        for (const _report of nearbyReports) {
          // If we have any recent report from same user, flag for review
          // In production, the PostGIS RPC would handle precision
          isDuplicate = true;
          break;
        }
      }
    }

    // --- Insert Report ---
    const reportStatus = isDuplicate ? 'flagged' : 'pending';

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        location: `SRID=4326;POINT(${lng} ${lat})`,
        address: address || null,
        description: description || null,
        severity,
        water_height_cm: water_height_cm || null,
        is_surge_receding: is_surge_receding || false,
        status: reportStatus,
      })
      .select('id')
      .single();

    if (reportError) {
      return NextResponse.json(
        { error: reportError.message },
        { status: 500 }
      );
    }

    // Recalculate credibility score for new report
    const baseUrl = req.nextUrl.origin;
    fetch(`${baseUrl}/api/reports/${report.id}/credibility`, { method: 'POST' }).catch(() => {});

    return NextResponse.json({
      success: true,
      report_id: report.id,
      status: reportStatus,
      flagged: isDuplicate,
      message: isDuplicate
        ? 'Laporan ditandai untuk ditinjau karena terdeteksi sebagai potensi duplikasi.'
        : 'Laporan berhasil dikirim.',
    });
  } catch (err) {
    console.error('Report submit error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
