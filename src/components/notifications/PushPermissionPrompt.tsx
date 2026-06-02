'use client';

/**
 * FR-033 — Push Permission Prompt / Toggle
 *
 * Opt-in/opt-out Web Push: register service worker, minta izin notifikasi,
 * subscribe via PushManager (VAPID), simpan ke server. Aman dipasang di
 * /settings/notifications. Tidak memaksa — user memilih sendiri.
 */

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushPermissionPrompt() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false);
      return;
    }
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setSubscribed(!!sub);
    });
  }, []);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMsg('Izin notifikasi ditolak.');
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw-push.js');
      await navigator.serviceWorker.ready;
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) { setMsg('VAPID key belum dikonfigurasi.'); setBusy(false); return; }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error('save failed');
      setSubscribed(true);
      setMsg('Notifikasi perangkat aktif.');
    } catch (e) {
      console.error('enable push error:', e);
      setMsg('Gagal mengaktifkan notifikasi.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg('Notifikasi perangkat dimatikan.');
    } catch (e) {
      console.error('disable push error:', e);
      setMsg('Gagal mematikan notifikasi.');
    } finally {
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <BellOff size={18} color="var(--text-muted)" />
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Perangkat/browser ini tidak mendukung push notification.
        </span>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
          background: subscribed ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Bell size={18} color={subscribed ? '#22c55e' : 'var(--primary-400)'} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>Notifikasi Perangkat (Push)</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            {subscribed ? 'Aktif — Anda akan menerima peringatan banjir di perangkat ini.' : 'Dapatkan peringatan banjir walau aplikasi tertutup.'}
          </p>
        </div>
        <button
          onClick={subscribed ? disable : enable}
          disabled={busy}
          className={subscribed ? 'btn btn-ghost' : 'btn btn-primary'}
          style={{ flexShrink: 0, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : subscribed ? <BellOff size={14} /> : <Bell size={14} />}
          {subscribed ? 'Matikan' : 'Aktifkan'}
        </button>
      </div>
      {msg && <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '0.5rem 0 0' }}>{msg}</p>}
    </div>
  );
}
