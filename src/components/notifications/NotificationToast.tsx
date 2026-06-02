'use client';

/**
 * FR-047 — In-App Notification Toast
 *
 * Mendengarkan INSERT realtime pada tabel notifications untuk pengguna aktif,
 * lalu menampilkan toast pop-up (auto-dismiss) di seluruh halaman. Klik toast →
 * navigasi ke laporan terkait / halaman notifikasi. Dipasang global di AppShell.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, MapPin, FileCheck2, FileX2, Radio, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Notification, NotificationType } from '@/types/database';

const META: Record<NotificationType, { icon: typeof Bell; color: string }> = {
  status_change: { icon: MapPin, color: '#3b82f6' },
  report_verified: { icon: FileCheck2, color: '#22c55e' },
  report_rejected: { icon: FileX2, color: '#ef4444' },
  broadcast: { icon: Radio, color: '#8b5cf6' },
  area_status_update: { icon: MapPin, color: '#0891b2' },
};

const DISMISS_MS = 6000;
const MAX_VISIBLE = 3;

interface ToastItem extends Notification {
  toastKey: number;
}

export default function NotificationToast() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const mounted = useRef(false);

  const dismiss = useCallback((key: number) => {
    setToasts((prev) => prev.filter((t) => t.toastKey !== key));
  }, []);

  const push = useCallback((n: Notification) => {
    const toastKey = ++seq.current;
    setToasts((prev) => [...prev, { ...n, toastKey }].slice(-MAX_VISIBLE));
    setTimeout(() => dismiss(toastKey), DISMISS_MS);
  }, [dismiss]);

  useEffect(() => {
    if (!user) return;
    // Hindari double-subscribe pada StrictMode remount
    mounted.current = true;

    const channel = supabase
      .channel(`notif-toast-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload: { new: Notification }) => {
          if (mounted.current) push(payload.new);
        }
      )
      .subscribe();

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [user, supabase, push]);

  const handleClick = (t: ToastItem) => {
    dismiss(t.toastKey);
    if (!t.is_read) supabase.from('notifications').update({ is_read: true }).eq('id', t.id).then(() => {});
    if (t.related_report_id) router.push(`/report/${t.related_report_id}`);
    else router.push('/notifications');
  };

  if (!isAuthenticated || toasts.length === 0) return null;

  return (
    <div className="notif-toast-wrap">
      <style>{`
        .notif-toast-wrap {
          position: fixed; top: 66px; right: 16px; z-index: 2200;
          display: flex; flex-direction: column; gap: 0.5rem;
          width: 340px; max-width: calc(100vw - 32px); pointer-events: none;
        }
        @media (max-width: 480px) {
          .notif-toast-wrap { top: 62px; left: 12px; right: 12px; width: auto; }
        }
        .notif-toast {
          pointer-events: auto;
          animation: toastIn 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(24px) scale(0.96); }
          to   { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
      {toasts.map((t) => {
        const m = META[t.type] ?? { icon: Bell, color: 'var(--primary-400)' };
        const Icon = m.icon;
        return (
          <div
            key={t.toastKey}
            className="notif-toast glass"
            onClick={() => handleClick(t)}
            style={{
              display: 'flex', gap: '0.625rem', padding: '0.75rem 0.875rem',
              borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)',
              borderLeft: `3px solid ${m.color}`, boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
              cursor: 'pointer', alignItems: 'flex-start',
            }}
          >
            <div style={{
              width: '34px', height: '34px', borderRadius: 'var(--radius-md)', flexShrink: 0,
              background: `${m.color}1f`, border: `1px solid ${m.color}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={16} color={m.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '0.8125rem', fontWeight: 700, margin: 0,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {t.title}
              </p>
              <p style={{
                fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.4,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {t.body}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); dismiss(t.toastKey); }}
              aria-label="Tutup"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0, display: 'flex' }}
            >
              <X size={14} color="var(--text-muted)" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
