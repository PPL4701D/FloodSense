'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import WaveLoader from '@/components/ui/WaveLoader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  User, Mail, Shield, Star, MapPin, LogIn,
  FileText, Settings, ChevronRight, Loader2,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, loading, isAuthenticated, signOut } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50dvh' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '400px', margin: '3rem auto' }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: 'var(--radius-full)',
          background: 'rgba(59,130,246,0.15)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
        }}>
          <User size={28} color="var(--primary-400)" />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Masuk untuk Melihat Profil
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Kelola akun Anda dan lihat riwayat laporan
        </p>
        <Link href="/login?redirect=/profile" className="btn btn-primary" style={{ width: '100%' }}>
          <LogIn size={16} /> Masuk
        </Link>
      </div>
    );
  }

  const ROLE_LABELS: Record<string, string> = {
    warga: 'Warga',
    staf: 'Staf BPBD',
    tlm: 'Team Leader',
    admin: 'Admin',
  };

  const menuItems = [
    { href: '/my-reports', icon: FileText, label: 'Laporan Saya' },
    { href: '/settings', icon: Settings, label: 'Pengaturan' },
  ];

  return (
    <>
      <style>{`
        .profile-page { padding: 1rem; max-width: 800px; margin: 0 auto; }
        .profile-grid { display: flex; flex-direction: column; gap: 1rem; }
        @media (min-width: 768px) {
          .profile-page { padding: 2rem; }
          .profile-grid { display: grid; grid-template-columns: 320px 1fr; gap: 1.5rem; align-items: start; }
        }
      `}</style>
      <div className="profile-page">
        <div className="profile-grid">
          {/* Profile Card */}
          <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--primary-600), #0891b2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem', border: '3px solid var(--bg-card)',
              boxShadow: '0 0 20px rgba(59,130,246,0.3)', overflow: 'hidden',
              fontSize: '1.75rem', fontWeight: 800, color: 'white',
            }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                profile?.full_name?.charAt(0)?.toUpperCase() || '?'
              )}
            </div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>
              {profile?.full_name || 'Pengguna'}
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', marginBottom: '1.25rem' }}>
              <Mail size={12} /> {user?.email}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                  <Shield size={14} color="var(--primary-400)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    {ROLE_LABELS[profile?.role || 'warga']}
                  </span>
                </div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>Peran</p>
              </div>
              <div style={{ width: '1px', background: 'var(--border-primary)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                  <Star size={14} color="#eab308" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                    {profile?.reputation_score || 0}
                  </span>
                </div>
                <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '2px' }}>Reputasi</p>
              </div>
            </div>
          </div>

          {/* Menu + Logout */}
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {menuItems.map((item) => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="card" style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.875rem 1rem', cursor: 'pointer',
                  }}>
                    <item.icon size={18} color="var(--text-secondary)" />
                    <span style={{ flex: 1, fontSize: '0.875rem' }}>{item.label}</span>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Logout */}
            <button onClick={signOut} className="btn btn-danger" style={{ width: '100%' }}>
              Keluar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
