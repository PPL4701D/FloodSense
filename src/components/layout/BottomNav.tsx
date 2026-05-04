'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Map, FileText, PlusCircle, Bell, User, LayoutDashboard, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';

type NavItem =
  | { isAction: true }
  | { href: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>; label: string };

export default function BottomNav() {
  const pathname = usePathname();
  const { isAuthenticated, profile, user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!user) return;

    const checkUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      setHasUnread(!!(count && count > 0));
    };

    checkUnread();

    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          checkUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase]);

  const role = profile?.role;
  const isStaff = role && ['staf', 'tlm', 'admin'].includes(role);

  const roleItem = isStaff
    ? role === 'staf'
      ? { href: '/staff/verification', icon: ShieldCheck, label: 'Verifikasi' }
      : { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }
    : { href: '/notifications', icon: Bell, label: 'Notif' };

  /**
   * Item order ensures "+" is ALWAYS the middle element:
   *   Not logged in (3 items):  [Peta]  [+]  [Laporan]
   *   Logged in     (5 items):  [Peta] [Laporan]  [+]  [roleItem] [Profil]
   */
  const navItems: NavItem[] = isAuthenticated
    ? [
        { href: '/', icon: Map, label: 'Peta' },
        { href: '/reports', icon: FileText, label: 'Laporan' },
        { isAction: true },
        roleItem,
        { href: '/profile', icon: User, label: 'Profil' },
      ]
    : [
        { href: '/', icon: Map, label: 'Peta' },
        { isAction: true },
        { href: '/reports', icon: FileText, label: 'Laporan' },
      ];

  // Dynamic compact width: each slot gets ~84px
  const maxWidthPx = navItems.length * 84;

  return (
    <nav style={{
      position: 'fixed',
      bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
      left: '50%',
      transform: 'translateX(-50%)',
      width: `${maxWidthPx}px`,
      maxWidth: 'calc(100% - 32px)',
      zIndex: 2000,
      transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)',
    }}>
      <div
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          height: '72px',
          padding: '0 8px',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '36px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
      >
        {navItems.map((item, idx) => {
          // ── Action button ────────────────────────────────
          if ('isAction' in item) {
            return (
              <Link
                key="action"
                href={isAuthenticated ? '/report/new' : '/login?redirect=/report/new'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  textDecoration: 'none', flexShrink: 0,
                }}
              >
                <div
                  className="animate-pulse-glow"
                  style={{
                    width: '52px', height: '52px',
                    borderRadius: 'var(--radius-full)',
                    background: 'linear-gradient(135deg, var(--primary-500), #0891b2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(59,130,246,0.4)',
                  }}
                >
                  <PlusCircle size={24} color="white" />
                </div>
              </Link>
            );
          }

          // ── Regular nav item ─────────────────────────────
          const { href, icon: Icon, label } = item;
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={idx}
              href={href}
              onClick={() => {
                if (href === '/notifications') setHasUnread(false);
              }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '4px', textDecoration: 'none',
                width: '60px', height: '56px', borderRadius: '28px',
                background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
                transition: 'all var(--transition-fast)',
                flexShrink: 0,
              }}
            >
              <div style={{ position: 'relative', display: 'flex' }}>
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 2}
                  color={isActive ? 'var(--primary-400)' : 'var(--text-secondary)'}
                />
                {href === '/notifications' && hasUnread && (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    border: '1.5px solid var(--bg-primary)',
                  }} />
                )}
              </div>
              <span style={{
                fontSize: '0.625rem',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--primary-400)' : 'var(--text-secondary)',
              }}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
