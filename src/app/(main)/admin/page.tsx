'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import WaveLoader from '@/components/ui/WaveLoader';
import {
  Users, ScrollText, Shield, Activity, LayoutDashboard,
  ChevronRight, AlertTriangle, CheckCircle2, FileText,
  TrendingUp, Crown,
} from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  totalReports: number;
  pendingReports: number;
  activeFloodAreas: number;
}

export default function AdminPage() {
  const { role, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || role !== 'admin')) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, role, router]);

  useEffect(() => {
    if (role !== 'admin') return;
    const fetchStats = async () => {
      const [
        { count: totalUsers },
        { count: totalReports },
        { count: pendingReports },
        { count: activeFloodAreas },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('area_status').select('*', { count: 'exact', head: true })
          .eq('status', 'banjir_aktif').is('valid_until', null),
      ]);
      setStats({
        totalUsers: totalUsers ?? 0,
        totalReports: totalReports ?? 0,
        pendingReports: pendingReports ?? 0,
        activeFloodAreas: activeFloodAreas ?? 0,
      });
      setStatsLoading(false);
    };
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  const MENU_ITEMS = [
    {
      href: '/admin/users',
      icon: Users,
      color: '#3b82f6',
      title: 'Kelola Pengguna',
      desc: 'Ubah role, lihat & cari semua user',
    },
    {
      href: '/admin/audit-logs',
      icon: ScrollText,
      color: '#8b5cf6',
      title: 'Audit Log',
      desc: 'Riwayat semua aksi sistem',
    },
    {
      href: '/dashboard',
      icon: TrendingUp,
      color: '#06b6d4',
      title: 'Dashboard Analitik',
      desc: 'KPI, tren banjir, perbandingan wilayah',
    },
    {
      href: '/staff/verification',
      icon: Shield,
      color: '#22c55e',
      title: 'Verifikasi Laporan',
      desc: 'Queue verifikasi laporan masuk',
    },
  ];

  const STAT_ITEMS = [
    { label: 'Total Pengguna', value: stats?.totalUsers, icon: Users, color: '#3b82f6' },
    { label: 'Total Laporan', value: stats?.totalReports, icon: FileText, color: '#06b6d4' },
    { label: 'Menunggu Verifikasi', value: stats?.pendingReports, icon: AlertTriangle, color: '#eab308' },
    { label: 'Wilayah Banjir Aktif', value: stats?.activeFloodAreas, icon: Activity, color: '#ef4444' },
  ];

  return (
    <div className="page-scroll" style={{ paddingBottom: '100px' }}>
      {/* Hero Header */}
      <div style={{
        padding: '1.5rem 1rem 1rem',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(139,92,246,0.08) 100%)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Crown size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Admin Panel</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kontrol penuh sistem FloodSense</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '1rem', maxWidth: '480px', margin: '0 auto' }}>
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {STAT_ITEMS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="card" style={{ padding: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <Icon size={14} color={s.color} />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{s.label}</span>
                </div>
                {statsLoading ? (
                  <div style={{ height: '28px', width: '40px', borderRadius: '4px', background: 'var(--bg-secondary)', animation: 'pulse 1.5s infinite' }} />
                ) : (
                  <p style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Menu Items */}
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
          Manajemen
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{ textDecoration: 'none' }}
              >
                <div className="card" style={{
                  padding: '1rem',
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  transition: 'all var(--transition-fast)',
                  cursor: 'pointer',
                }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
                    background: `${item.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={22} color={item.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{item.title}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '1px' }}>{item.desc}</p>
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Status */}
        <div style={{ marginTop: '1.5rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            Status Sistem
          </p>
          <div className="card" style={{ padding: '1rem' }}>
            {[
              { label: 'Database Supabase', ok: true },
              { label: 'Storage Bucket', ok: true },
              { label: 'API Routes', ok: true },
              { label: 'Tabel regions (perlu seeding)', ok: false },
            ].map((s) => (
              <div key={s.label} style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.375rem 0',
                borderBottom: '1px solid var(--border-primary)',
              }}>
                {s.ok
                  ? <CheckCircle2 size={14} color="#22c55e" />
                  : <AlertTriangle size={14} color="#eab308" />
                }
                <span style={{ fontSize: '0.8125rem', flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: '0.625rem', color: s.ok ? '#22c55e' : '#eab308', fontWeight: 600 }}>
                  {s.ok ? 'OK' : 'PERLU TINDAKAN'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
