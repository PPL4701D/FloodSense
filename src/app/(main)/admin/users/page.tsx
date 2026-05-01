'use client';

import { useEffect, useState, useCallback } from 'react';
import WaveLoader from '@/components/ui/WaveLoader';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';
import {
  Users, Shield, ChevronLeft, Loader2, Search,
  ChevronDown, Crown, UserCheck, User, X, AlertTriangle,
} from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  reputation_score: number;
  avatar_url: string | null;
  created_at: string;
}

const ROLE_META: Record<string, { label: string; color: string; icon: typeof User }> = {
  warga: { label: 'Warga', color: '#94a3b8', icon: User },
  staf: { label: 'Staf', color: '#3b82f6', icon: UserCheck },
  tlm: { label: 'TLM', color: '#8b5cf6', icon: Shield },
  admin: { label: 'Admin', color: '#f59e0b', icon: Crown },
};

export default function AdminUsersPage() {
  const { user, role, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [newRole, setNewRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || role !== 'admin')) {
      router.push('/');
    }
  }, [authLoading, isAuthenticated, role, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && role === 'admin') fetchUsers();
  }, [user, role, fetchUsers]);

  const filteredUsers = users.filter((u) => {
    const matchesSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleRoleChange = async () => {
    if (!editingUser || !newRole) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: editingUser.id, role: newRole }),
      });
      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  return (
    <div className="page-scroll" style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{
        padding: '1rem', background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex' }}>
            <ChevronLeft size={20} color="var(--text-primary)" />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={20} color="var(--primary-400)" />
              Kelola Pengguna
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{users.length} total pengguna</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email..."
              style={{
                width: '100%', padding: '8px 8px 8px 32px',
                background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontSize: '0.8125rem', outline: 'none',
              }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{
                padding: '8px 28px 8px 10px',
                background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                fontSize: '0.75rem', appearance: 'none', cursor: 'pointer',
              }}
            >
              <option value="all">Semua Role</option>
              <option value="warga">Warga</option>
              <option value="staf">Staf</option>
              <option value="tlm">TLM</option>
              <option value="admin">Admin</option>
            </select>
            <ChevronDown size={12} color="var(--text-muted)" style={{
              position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none',
            }} />
          </div>
        </div>
      </div>

      {/* User List */}
      <div style={{ padding: '1rem', maxWidth: '640px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem' }}>
            <WaveLoader size={48} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Users size={48} strokeWidth={1} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
            <p style={{ fontSize: '0.875rem' }}>Tidak ada pengguna ditemukan.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredUsers.map((u) => {
              const meta = ROLE_META[u.role] || ROLE_META.warga;
              const RoleIcon = meta.icon;
              return (
                <div
                  key={u.id}
                  className="card"
                  style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-secondary)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
                    overflow: 'hidden',
                  }}>
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      u.full_name?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{u.full_name || 'Tanpa Nama'}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.email}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.625rem', fontWeight: 600, padding: '2px 8px',
                    borderRadius: 'var(--radius-full)', display: 'flex',
                    alignItems: 'center', gap: '4px',
                    background: `${meta.color}15`, color: meta.color,
                  }}>
                    <RoleIcon size={10} />
                    {meta.label}
                  </span>
                  {u.id !== user?.id && (
                    <button
                      onClick={() => { setEditingUser(u); setNewRole(u.role); }}
                      style={{
                        background: 'none', border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-sm)', padding: '4px 8px',
                        fontSize: '0.625rem', cursor: 'pointer', color: 'var(--text-muted)',
                      }}
                    >
                      Ubah
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role Edit Modal */}
      {editingUser && (
        <>
          <div onClick={() => setEditingUser(null)} style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          }} />
          <div className="animate-slide-up" style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1001,
            background: 'var(--bg-card)', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
            padding: '1.5rem',
          }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'var(--border-primary)', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Ubah Role — {editingUser.full_name}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {editingUser.email}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {['warga', 'staf', 'tlm', 'admin'].map((r) => {
                const m = ROLE_META[r];
                return (
                  <button
                    key={r}
                    onClick={() => setNewRole(r)}
                    style={{
                      flex: '1 1 80px', padding: '10px', borderRadius: 'var(--radius-md)',
                      border: `2px solid ${newRole === r ? m.color : 'var(--border-primary)'}`,
                      background: newRole === r ? `${m.color}10` : 'var(--bg-secondary)',
                      color: newRole === r ? m.color : 'var(--text-secondary)',
                      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      textAlign: 'center', transition: 'all var(--transition-fast)',
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
            {newRole === 'admin' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)',
                background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)',
                marginBottom: '0.75rem',
              }}>
                <AlertTriangle size={14} color="#f97316" />
                <p style={{ fontSize: '0.6875rem', color: '#f97316' }}>
                  Admin memiliki akses penuh ke sistem. Pastikan Anda yakin.
                </p>
              </div>
            )}
            <button
              onClick={handleRoleChange}
              disabled={submitting || newRole === editingUser.role}
              className="btn btn-primary"
              style={{
                width: '100%', padding: '12px',
                opacity: submitting || newRole === editingUser.role ? 0.5 : 1,
                cursor: submitting || newRole === editingUser.role ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Simpan'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
