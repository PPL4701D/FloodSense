import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * FR-035 — Broadcast Pesan Peringatan oleh TLM
 *
 * POST /api/broadcast
 *   body: { regionIds: string[], severity: 'informasi'|'waspada'|'darurat',
 *           message: string, expiresHours?: number }
 *
 * Alur:
 *   1. Validasi peran (hanya tlm/admin).
 *   2. Simpan ke broadcast_messages.
 *   3. Kumpulkan penerima = pelapor pada wilayah target + petugas ber-assigned_region.
 *   4. Sisipkan notifikasi in-app (type 'broadcast') untuk tiap penerima.
 *   5. Picu web-push via /api/push/send (best-effort).
 */

const SEVERITIES = ['informasi', 'waspada', 'darurat'] as const;
type Severity = (typeof SEVERITIES)[number];

const SEVERITY_TITLE: Record<Severity, string> = {
  informasi: 'ℹ️ Informasi Banjir',
  waspada: '⚠️ Peringatan Waspada Banjir',
  darurat: '🚨 Darurat Banjir',
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['tlm', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Hanya TLM/Admin yang dapat melakukan broadcast' }, { status: 403 });
    }

    const body = await req.json();
    const regionIds: string[] = Array.isArray(body.regionIds) ? body.regionIds.filter(Boolean) : [];
    const severity: Severity = body.severity;
    const message: string = (body.message ?? '').trim();
    const expiresHours: number = Number.isFinite(body.expiresHours) ? Math.min(168, Math.max(1, body.expiresHours)) : 24;

    if (regionIds.length === 0) return NextResponse.json({ error: 'Pilih minimal satu wilayah' }, { status: 400 });
    if (!SEVERITIES.includes(severity)) return NextResponse.json({ error: 'Tingkat keparahan tidak valid' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Pesan wajib diisi' }, { status: 400 });
    if (message.length > 500) return NextResponse.json({ error: 'Pesan maksimal 500 karakter' }, { status: 400 });

    const admin = createAdminClient();

    // 2. Simpan broadcast
    const expiresAt = new Date(Date.now() + expiresHours * 3600000).toISOString();
    const { data: broadcast, error: bcErr } = await admin
      .from('broadcast_messages')
      .insert({
        sender_id: user.id,
        target_regions: regionIds,
        message,
        severity_level: severity,
        is_active: true,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (bcErr) {
      console.error('broadcast insert error:', bcErr);
      return NextResponse.json({ error: 'Gagal menyimpan broadcast' }, { status: 500 });
    }

    // 3a. Perluas wilayah target → sertakan seluruh turunannya
    //     (mis. memilih Provinsi otomatis mencakup kabupaten & kecamatan di bawahnya).
    const { data: allRegions } = await admin.from('regions').select('id, name, parent_id');
    const childrenOf = new Map<string, string[]>();
    const nameOf = new Map<string, string>();
    (allRegions as Array<{ id: string; name: string; parent_id: string | null }> | null)?.forEach((r) => {
      nameOf.set(r.id, r.name);
      if (r.parent_id) {
        const arr = childrenOf.get(r.parent_id) ?? [];
        arr.push(r.id);
        childrenOf.set(r.parent_id, arr);
      }
    });
    const expandedRegions = new Set<string>(regionIds);
    const queue = [...regionIds];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const child of childrenOf.get(cur) ?? []) {
        if (!expandedRegions.has(child)) { expandedRegions.add(child); queue.push(child); }
      }
    }
    const regionScope = Array.from(expandedRegions);

    // 3b. Kumpulkan penerima (unik, kecuali pengirim):
    //     pelapor di wilayah target + petugas ber-assigned_region di wilayah target.
    const recipients = new Set<string>();
    const [{ data: reporters }, { data: officers }] = await Promise.all([
      admin.from('reports').select('reporter_id').in('region_id', regionScope),
      admin.from('profiles').select('id').in('assigned_region_id', regionScope),
    ]);
    (reporters as Array<{ reporter_id: string }> | null)?.forEach((r) => r.reporter_id && recipients.add(r.reporter_id));
    (officers as Array<{ id: string }> | null)?.forEach((o) => o.id && recipients.add(o.id));

    // 3c. Fail-open: peringatan banjir tidak boleh "nyangkut" ke 0 orang.
    //     Bila wilayah target belum memiliki pelapor/petugas terasosiasi,
    //     kirim ke seluruh pengguna terdaftar (kecuali pengirim).
    let usedFallback = false;
    if (recipients.size === 0) {
      usedFallback = true;
      const { data: everyone } = await admin.from('profiles').select('id');
      (everyone as Array<{ id: string }> | null)?.forEach((p) => p.id && recipients.add(p.id));
    }

    recipients.delete(user.id);
    const userIds = Array.from(recipients);

    // Label wilayah untuk judul notifikasi, mis. "Jawa Barat" / "Jawa Barat +2 wilayah".
    const regionNamesSel = regionIds.map((id) => nameOf.get(id) ?? 'Wilayah').filter(Boolean);
    const regionLabel =
      regionNamesSel.length === 0 ? ''
      : regionNamesSel.length <= 2 ? regionNamesSel.join(', ')
      : `${regionNamesSel.slice(0, 2).join(', ')} +${regionNamesSel.length - 2} wilayah`;
    const title = regionLabel ? `${SEVERITY_TITLE[severity]} · ${regionLabel}` : SEVERITY_TITLE[severity];

    // 4. Notifikasi in-app
    if (userIds.length > 0) {
      const notifRows = userIds.map((uid) => ({
        user_id: uid,
        type: 'broadcast' as const,
        title,
        body: message,
        related_region_id: regionIds[0],
      }));
      const { error: notifErr } = await admin.from('notifications').insert(notifRows);
      if (notifErr) console.error('broadcast notifications error:', notifErr);
    }

    // 5. Web-push best-effort
    let pushed = 0;
    if (userIds.length > 0) {
      try {
        const origin = req.nextUrl.origin;
        const res = await fetch(`${origin}/api/push/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
          body: JSON.stringify({ userIds, title, body: message, url: '/notifications', type: 'broadcast' }),
        });
        if (res.ok) {
          const j = await res.json();
          pushed = j.sent ?? 0;
        }
      } catch (e) {
        console.error('broadcast push trigger error:', e);
      }
    }

    return NextResponse.json({
      success: true,
      broadcastId: broadcast.id,
      recipients: userIds.length,
      pushed,
      usedFallback,
    });
  } catch (err) {
    console.error('POST /api/broadcast error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
