import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

/**
 * FR-033 — Kirim Web Push ke subscriber.
 *
 * POST /api/push/send  body: { userIds: string[], title, body, url? }
 * Dipakai oleh trigger verifikasi & broadcast TLM (PBI-18).
 * Hanya staf/tlm/admin yang boleh memicu.
 */

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@floodsense.id';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  vapidReady = true;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['staf', 'tlm', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!ensureVapid()) {
      return NextResponse.json({ error: 'VAPID belum dikonfigurasi' }, { status: 500 });
    }

    const { userIds, title, body, url } = await req.json();
    if (!Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
      return NextResponse.json({ error: 'userIds, title, body wajib diisi' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', userIds);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'Tidak ada subscriber' });
    }

    const payload = JSON.stringify({ title, body, url: url || '/' });
    let sent = 0;
    const expired: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          sent++;
        } catch (e: unknown) {
          const statusCode = (e as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) expired.push(s.id); // subscription mati
        }
      })
    );

    if (expired.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', expired);
    }

    return NextResponse.json({ success: true, sent, removed: expired.length });
  } catch (err) {
    console.error('POST /api/push/send error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
