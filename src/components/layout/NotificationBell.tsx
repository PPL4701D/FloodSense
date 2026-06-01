'use client';

/**
 * FR-047 — Global NotificationBell
 *
 * Lonceng notifikasi di Header untuk SEMUA role login. Menampilkan badge jumlah
 * belum dibaca (realtime) + dropdown 5 notifikasi terbaru. Klik item → tandai
 * dibaca + navigasi ke laporan terkait. Tombol "Lihat semua" → /notifications.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell, MapPin, FileCheck2, FileX2, Radio, CheckCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Notification, NotificationType } from '@/types/database';

const NOTIF_ICONS: Record<NotificationType, typeof Bell> = {
  status_change: MapPin,
  report_verified: FileCheck2,
  report_rejected: FileX2,
  broadcast: Radio,
  area_status_update: MapPin,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min} mnt lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const day = Math.floor(hr / 24);
  return `${day} hari lalu`;
}

export default function NotificationBell() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchLatest = useCallback(async () => {
    if (!user) return;
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false),
    ]);
    setItems(data ?? []);
    setUnread(count ?? 0);
  }, [supabase, user]);

  // Initial fetch + realtime subscription (per-user)
  useEffect(() => {
    if (!user) return;
    fetchLatest();

    const channel = supabase
      .channel('notif-bell-header')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchLatest()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, fetchLatest]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handleItemClick = async (n: Notification) => {
    setOpen(false);
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (n.related_report_id) router.push(`/report/${n.related_report_id}`);
    else router.push('/notifications');
  };

  const markAllRead = async () => {
    if (!user || unread === 0) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
  };

  if (!isAuthenticated) return null;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost"
        title="Notifikasi"
        aria-label="Notifikasi"
        style={{
          position: 'relative', padding: '6px', borderRadius: 'var(--radius-sm)',
          border: 'none', cursor: 'pointer', background: 'none', display: 'flex',
        }}
      >
        <Bell size={20} color="var(--text-secondary)" />
        {unread > 0 && (
          <span
            style={{
              position: 'absolute', top: '0px', right: '0px',
              minWidth: '16px', height: '16px', padding: '0 4px',
              borderRadius: '8px', background: '#ef4444', color: '#fff',
              fontSize: '0.625rem', fontWeight: 700, lineHeight: '16px',
              textAlign: 'center', border: '1.5px solid var(--bg-primary)',
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="glass"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: '320px', maxWidth: 'calc(100vw - 24px)',
            borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-primary)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)', overflow: 'hidden', zIndex: 2100,
          }}
        >
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.75rem 0.875rem', borderBottom: '1px solid var(--border-primary)',
            }}
          >
            <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>Notifikasi</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--primary-400)',
                  fontSize: '0.6875rem', fontWeight: 600,
                }}
              >
                <CheckCheck size={13} /> Tandai dibaca
              </button>
            )}
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                Belum ada notifikasi
              </div>
            ) : (
              items.map((n) => {
                const Icon = NOTIF_ICONS[n.type] ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    style={{
                      display: 'flex', gap: '0.625rem', width: '100%', textAlign: 'left',
                      padding: '0.75rem 0.875rem', background: n.is_read ? 'none' : 'rgba(59,130,246,0.08)',
                      border: 'none', borderBottom: '1px solid var(--border-primary)', cursor: 'pointer',
                    }}
                  >
                    <div style={{ flexShrink: 0, marginTop: '2px' }}>
                      <Icon size={16} color={n.is_read ? 'var(--text-muted)' : 'var(--primary-400)'} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        fontSize: '0.8125rem', fontWeight: n.is_read ? 500 : 700,
                        color: 'var(--text-primary)', margin: 0,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {n.title}
                      </p>
                      <p style={{
                        fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      }}>
                        {n.body}
                      </p>
                      <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</span>
                    </div>
                    {!n.is_read && (
                      <span style={{
                        flexShrink: 0, width: '8px', height: '8px', borderRadius: '50%',
                        background: 'var(--primary-500)', marginTop: '4px',
                      }} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            style={{
              display: 'block', textAlign: 'center', padding: '0.75rem',
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-400)',
              textDecoration: 'none', borderTop: '1px solid var(--border-primary)',
            }}
          >
            Lihat semua
          </Link>
        </div>
      )}
    </div>
  );
}
