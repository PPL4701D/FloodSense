'use client';

import { useEffect, useState, useCallback } from 'react';
import WaveLoader from '@/components/ui/WaveLoader';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Notification } from '@/types/database';
import {
  Bell, BellOff, Check, CheckCheck, MapPin,
  FileCheck2, FileX2, Radio, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const NOTIF_ICONS: Record<string, typeof Bell> = {
  status_change: MapPin,
  report_verified: FileCheck2,
  report_rejected: FileX2,
  broadcast: Radio,
  area_status_update: MapPin,
};

export default function NotificationsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data);
    }
    setLoading(false);
  }, [supabase, user]);

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, fetchNotifications]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (authLoading || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Masuk untuk melihat notifikasi</p>
        <Link href="/login?redirect=/notifications" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Masuk
        </Link>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <style>{`
        .notif-page { padding: 1rem; max-width: 800px; margin: 0 auto; }
        @media (min-width: 768px) { .notif-page { padding: 2rem; } }
      `}</style>
      <div className="notif-page">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1rem',
        }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            Notifikasi
            {unreadCount > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '20px', height: '20px', borderRadius: 'var(--radius-full)',
                background: 'var(--primary-500)', color: 'white', fontSize: '0.6875rem',
                fontWeight: 700, marginLeft: '0.5rem',
              }}>
                {unreadCount}
              </span>
            )}
          </h1>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="btn btn-ghost" style={{ fontSize: '0.75rem', gap: '0.25rem', padding: '0.375rem 0.75rem' }}>
              <CheckCheck size={14} /> Tandai Semua Dibaca
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <BellOff size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Belum ada notifikasi</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {notifications.map((notif) => {
              const Icon = NOTIF_ICONS[notif.type] || Bell;
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                  className="card"
                  style={{
                    display: 'flex', gap: '0.75rem', padding: '0.875rem 1rem',
                    cursor: notif.is_read ? 'default' : 'pointer',
                    opacity: notif.is_read ? 0.7 : 1,
                    borderColor: notif.is_read ? 'var(--border-primary)' : 'var(--primary-500)',
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
                    background: notif.is_read ? 'var(--bg-elevated)' : 'rgba(59,130,246,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={16} color={notif.is_read ? 'var(--text-muted)' : 'var(--primary-400)'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: notif.is_read ? 400 : 600, marginBottom: '0.125rem' }}>
                      {notif.title}
                    </p>
                    <p style={{
                      fontSize: '0.75rem', color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {notif.body}
                    </p>
                    <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      {new Date(notif.created_at).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div style={{
                      width: '8px', height: '8px', borderRadius: 'var(--radius-full)',
                      background: 'var(--primary-500)', flexShrink: 0, marginTop: '4px',
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
