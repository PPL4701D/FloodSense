/**
 * FR-033 — Helper kirim Web Push ke sekumpulan user (server-side, Node runtime).
 *
 * Dipakai oleh trigger notifikasi (mis. laporan banjir di area titik pantau) agar
 * pengguna menerima push notification, bukan hanya notifikasi in-app. Best-effort:
 * tidak melempar error; subscription mati (404/410) dibersihkan otomatis.
 */

import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

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

export async function sendWebPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; url?: string }
): Promise<{ sent: number }> {
  try {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ensureVapid() || ids.length === 0) return { sent: 0 };

    const admin = createAdminClient();
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', ids);
    if (!subs || subs.length === 0) return { sent: 0 };

    const body = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url || '/' });
    let sent = 0;
    const expired: string[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
          sent++;
        } catch (e: unknown) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) expired.push(s.id);
        }
      })
    );

    if (expired.length > 0) await admin.from('push_subscriptions').delete().in('id', expired);
    return { sent };
  } catch {
    return { sent: 0 };
  }
}
