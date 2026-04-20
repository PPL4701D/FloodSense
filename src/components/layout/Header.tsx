'use client';

import { Droplets, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import Link from 'next/link';

export default function Header() {
  const { isAuthenticated, profile, signOut } = useAuth();

  return (
    <header className="glass" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 2000,
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1rem',
      borderBottom: '1px solid rgba(51,65,85,0.5)',
    }}>
      {/* Logo */}
      <Link href="/" style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        textDecoration: 'none', color: 'var(--text-primary)'
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
          background: 'linear-gradient(135deg, var(--primary-600), #0891b2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Droplets size={18} color="white" />
        </div>
        <span style={{ fontSize: '1rem', fontWeight: 700 }}>
          <span className="text-gradient">Flood</span>Sense
        </span>
      </Link>

      {/* Right Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {isAuthenticated ? (
          <>
            {/* Staff/TLM/Admin badge — text only, no navigation */}
            {profile && ['staf', 'tlm', 'admin'].includes(profile.role) && (
              <span
                style={{
                  display: 'inline-flex', alignItems: 'center',
                  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.6875rem', fontWeight: 700,
                  color: 'var(--primary-400)',
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  letterSpacing: '0.05em',
                }}>
                {profile.role.toUpperCase()}
              </span>
            )}
            {/* Avatar */}
            <Link href="/profile" style={{ textDecoration: 'none' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: 'var(--radius-full)',
                background: 'var(--bg-elevated)',
                border: '2px solid var(--primary-500)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-400)',
                overflow: 'hidden',
              }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  profile?.full_name?.charAt(0)?.toUpperCase() || '?'
                )}
              </div>
            </Link>
            {/* Logout */}
            <button
              onClick={signOut}
              className="btn-ghost"
              style={{ padding: '6px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', background: 'none' }}
              title="Keluar"
            >
              <LogOut size={18} color="var(--text-muted)" />
            </button>
          </>
        ) : (
          <Link href="/login" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8125rem' }}>
            <LogIn size={14} />
            Masuk
          </Link>
        )}
      </div>
    </header>
  );
}
