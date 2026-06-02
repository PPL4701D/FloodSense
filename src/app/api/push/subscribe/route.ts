import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * FR-033 — Push subscription management
 *
 * POST   /api/push/subscribe  → simpan PushSubscription user ke push_subscriptions
 * DELETE /api/push/subscribe  → hapus subscription (opt-out)
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const sub = body?.subscription ?? body;
    const endpoint: string | undefined = sub?.endpoint;
    const p256dh: string | undefined = sub?.keys?.p256dh;
    const auth: string | undefined = sub?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Subscription tidak lengkap' }, { status: 400 });
    }

    const admin = createAdminClient();
    // Hindari duplikat endpoint: hapus dulu yang lama, lalu insert.
    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint);
    const { error: insErr } = await admin.from('push_subscriptions').insert({
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: req.headers.get('user-agent') ?? null,
      last_used_at: new Date().toISOString(),
    });

    if (insErr) {
      console.error('push subscribe insert error:', insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/push/subscribe error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const endpoint = req.nextUrl.searchParams.get('endpoint');
    const admin = createAdminClient();
    let q = admin.from('push_subscriptions').delete().eq('user_id', user.id);
    if (endpoint) q = q.eq('endpoint', endpoint);
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/push/subscribe error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
