'use client';

import { LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';
import NotificationBell from './NotificationBell';

const iconBtn: React.CSSProperties = {
  width: '36px', height: '36px', borderRadius: '50%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
  cursor: 'pointer', flexShrink: 0, padding: 0,
  transition: 'background var(--transition-fast)',
};

export default function Header() {
  const { isAuthenticated, profile, signOut } = useAuth();
  const role = profile?.role;
  const isStaff = !!role && ['staf', 'tlm', 'admin'].includes(role);

  return (
    <>
      <style>{`
        .hdr-wordmark { display: inline; }
        .hdr-role { display: none; }
        @media (min-width: 480px) { .hdr-role { display: inline-flex; } }
        @media (max-width: 360px) { .hdr-wordmark { display: none; } }
        .hdr-iconbtn:hover { background: rgba(255,255,255,0.11) !important; }
      `}</style>

      <header className="glass" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000, height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 0.875rem', borderBottom: '1px solid rgba(51,65,85,0.5)',
      }}>
        {/* Logo */}
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          textDecoration: 'none', color: 'var(--text-primary)', minWidth: 0,
        }}>
          <img src="/floodsense-logo.png" alt="FloodSense" width={34} height={34}
            style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }} />
          <span className="hdr-wordmark" style={{ fontSize: '1.0625rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
            <span className="text-gradient">Flood</span>Sense
          </span>
        </Link>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {isAuthenticated ? (
            <>
              {isStaff && (
                <span className="hdr-role" style={{
                  alignItems: 'center', padding: '4px 9px', borderRadius: '999px',
                  fontSize: '0.625rem', fontWeight: 700, color: 'var(--primary-300)',
                  background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
                  letterSpacing: '0.06em', whiteSpace: 'nowrap',
                }}>
                  {role!.toUpperCase()}
                </span>
              )}

              <NotificationBell />

              {/* Avatar */}
              <Link href="/profile" title="Profil" style={{ textDecoration: 'none', flexShrink: 0 }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--bg-elevated)', border: '2px solid var(--primary-500)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary-400)', overflow: 'hidden',
                }}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    profile?.full_name?.charAt(0)?.toUpperCase() || '?'
                  )}
                </div>
              </Link>

              {/* Logout */}
              <button onClick={signOut} className="hdr-iconbtn" style={iconBtn} title="Keluar" aria-label="Keluar">
                <LogOut size={16} color="var(--text-secondary)" />
              </button>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary" style={{ padding: '7px 16px', fontSize: '0.8125rem', borderRadius: '999px' }}>
              <LogIn size={14} /> Masuk
            </Link>
          )}
        </div>
      </header>
    </>
  );
}
