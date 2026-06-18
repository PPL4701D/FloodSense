import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse, after } from 'next/server';
import { sendEmail, buildNewReportEmail } from '@/lib/email/resend';
import { resolveRegionId } from '@/lib/geo/resolveRegion';
import { sendWebPushToUsers } from '@/lib/push/send';

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
    const SPAM_LIMIT = 5;   // 5 laporan/jam diizinkan; laporan ke-6+ ditandai spam
    const HARD_LIMIT = 10;  // Rule 2: >10 laporan/jam → HTTP 429

    // Hitung jumlah laporan reporter dalam 1 jam terakhir.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('reports')
      .select('id', { count: 'exact', head: true })
      .eq('reporter_id', user.id)
      .gte('created_at', oneHourAgo);
    const hourCount = recentCount ?? 0;

    // Batas keras: cegah abuse berlebihan.
    if (hourCount >= HARD_LIMIT) {
      return NextResponse.json(
        { error: `Batas laporan tercapai (maks ${HARD_LIMIT} per jam). Coba lagi nanti.` },
        { status: 429 }
      );
    }

    let isDuplicate = false;

    // Spam rate: lebih dari 5 laporan dalam 1 jam → laporan ke-6+ ditandai (disembunyikan dari peta).
    if (hourCount >= SPAM_LIMIT) {
      isDuplicate = true;
    } else {
      // Duplikat lokasi: laporan reporter sendiri dalam radius ~100m & 30 menit terakhir (PostGIS).
      const { data: isDup, error: dupError } = await supabase.rpc('check_nearby_report', {
        p_reporter_id: user.id,
        p_lat: Number(lat),
        p_lng: Number(lng),
        p_radius_meters: 100,
        p_minutes_ago: 30,
      });
      if (dupError) console.error('check_nearby_report error:', dupError);
      if (isDup === true) isDuplicate = true;
    }

    // --- Insert Report ---
    const reportStatus = isDuplicate ? 'flagged' : 'pending';

    // FR-020: tentukan wilayah (provinsi/kab/kec) dari koordinat (reverse-geocode).
    const region_id = await resolveRegionId(supabase, Number(lat), Number(lng));

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
        region_id,
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

    // Side-effect best-effort (notifikasi proximity + email staf) dijalankan SETELAH
    // response terkirim via after(), agar submit pengguna tidak terblokir — mencegah
    // infinite loading saat Resend/web-push lambat. Pembuatan laporan & upload foto
    // (dilakukan klien setelah menerima report_id) tidak terpengaruh.
    after(async () => {
    // FR-037: Notify users whose monitoring points are within radius of the new report
    try {
      const adminSupabase = createAdminClient();
      const { data: allPrefs } = await adminSupabase
        .from('user_region_preferences')
        .select('user_id, label, lat, lng, radius_km')
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (allPrefs && allPrefs.length > 0) {
        const toRad = (d: number) => (d * Math.PI) / 180;
        const reportLat = Number(lat);
        const reportLng = Number(lng);
        const seen = new Set<string>();
        const notifications: {
          user_id: string;
          type: string;
          title: string;
          body: string;
          related_report_id: string;
        }[] = [];

        for (const p of allPrefs) {
          if (!p.lat || !p.lng) continue;
          if (p.user_id === user.id) continue;
          if (seen.has(p.user_id)) continue;

          const R = 6371;
          const dLat = toRad(p.lat - reportLat);
          const dLng = toRad(p.lng - reportLng);
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(reportLat)) * Math.cos(toRad(p.lat)) * Math.sin(dLng / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const radiusKm = p.radius_km || 5;

          if (dist <= radiusKm) {
            seen.add(p.user_id);
            const label = p.label || 'titik pantauan Anda';
            const addressText = address || `${reportLat.toFixed(4)}, ${reportLng.toFixed(4)}`;
            notifications.push({
              user_id: p.user_id,
              type: 'area_status_update',
              title: `Peringatan Banjir di Sekitar ${label}`,
              body: `Laporan banjir baru di ${addressText}, dalam radius ${radiusKm} km dari "${label}".`,
              related_report_id: report.id,
            });
          }
        }

        if (notifications.length > 0) {
          await adminSupabase.from('notifications').insert(notifications);
          // FR-033: kirim juga WEB PUSH ke pengguna titik pantau (bukan hanya in-app/toast).
          const notifiedIds = notifications.map((n) => n.user_id);
          const pushAddr = address || `${reportLat.toFixed(4)}, ${reportLng.toFixed(4)}`;
          await sendWebPushToUsers(notifiedIds, {
            title: '🌊 Banjir di Area Pantauan Anda',
            body: `Laporan banjir baru di ${pushAddr}. Ketuk untuk melihat detail.`,
            url: `/report/${report.id}`,
          });
        }
      }
    } catch (e: unknown) {
      console.error('Proximity notification error:', e instanceof Error ? e.message : String(e));
    }

    // FR-034 (PBI-17): Email alert ke staf penanggung jawab area laporan (non-flagged).
    // Staf yang ber-assigned_region pada wilayah laporan atau leluhurnya (kecamatan →
    // kabupaten → provinsi) dianggap bertanggung jawab. Fallback: bila tidak ada staf
    // ber-area yang cocok, kirim ke seluruh staf/TLM/admin agar alert tidak hilang.
    if (!isDuplicate) {
      try {
        const admin = createAdminClient();
        let staffIds = new Set<string>();
        if (region_id) {
          const { data: anc } = await admin.rpc('region_ancestor_ids', { p_region: region_id });
          const ancIds = ((anc as Array<{ id: string }> | null) ?? []).map((r) => r.id);
          if (ancIds.length > 0) {
            const { data: regionStaff } = await admin
              .from('profiles').select('id').in('role', ['staf', 'tlm', 'admin']).in('assigned_region_id', ancIds);
            staffIds = new Set((regionStaff ?? []).map((p) => p.id));
          }
        }
        if (staffIds.size === 0) {
          const { data: allStaff } = await admin.from('profiles').select('id').in('role', ['staf', 'tlm', 'admin']);
          staffIds = new Set((allStaff ?? []).map((p) => p.id));
        }
        if (staffIds.size > 0) {
          const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 });
          const emails = (authData?.users ?? [])
            .filter((u) => staffIds.has(u.id) && u.email)
            .map((u) => u.email as string);
          if (emails.length > 0) {
            const { subject, html } = buildNewReportEmail({
              severity, address: address || null, waterHeight: water_height_cm || null,
              description: description || null, reportUrl: `${req.nextUrl.origin}/report/${report.id}`,
            });
            const result = await sendEmail(emails, subject, html);
            if (!result.ok && !result.skipped) console.error('Staff email alert error:', result.error);
          }
        }
      } catch (e) {
        console.error('Staff email alert exception:', e instanceof Error ? e.message : String(e));
      }
    }
    });

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
