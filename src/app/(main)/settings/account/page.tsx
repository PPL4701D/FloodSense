'use client';

/**
 * FR-059 (PBI-34) — Manajemen Akun
 *
 * Halaman /settings/account (pengguna login). Ganti password (re-auth via
 * password lama), keluar dari semua perangkat (global sign out), dan hapus akun
 * (konfirmasi ketik HAPUS → DELETE /api/account → sign out + redirect).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import WaveLoader from '@/components/ui/WaveLoader';
import { ChevronLeft, KeyRound, LogOut, Trash2, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.75rem', fontSize: '0.875rem',
  background: 'var(--bg-elevated)', color: 'var(--text-primary)',
  border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-sm)',
};

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [signoutBusy, setSignoutBusy] = useState(false);
  const [delText, setDelText] = useState('');
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState<string | null>(null);

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><WaveLoader size={48} /></div>;
  }
  if (!isAuthenticated) {
    router.replace('/login?redirect=/settings/account');
    return null;
  }

  const changePassword = async () => {
    setPwMsg(null);
    if (newPw.length < 8) { setPwMsg({ ok: false, text: 'Password baru minimal 8 karakter' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Konfirmasi password tidak cocok' }); return; }
    setPwBusy(true);
    try {
      // Re-auth: verifikasi password lama
      const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: user!.email!, password: oldPw });
      if (reauthErr) { setPwMsg({ ok: false, text: 'Password lama salah' }); return; }
      const { error: updErr } = await supabase.auth.updateUser({ password: newPw });
      if (updErr) { setPwMsg({ ok: false, text: updErr.message }); return; }
      setPwMsg({ ok: true, text: 'Password berhasil diubah.' });
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } finally {
      setPwBusy(false);
    }
  };

  const signOutAll = async () => {
    setSignoutBusy(true);
    await supabase.auth.signOut({ scope: 'global' });
    router.replace('/login');
  };

  const deleteAccount = async () => {
    setDelErr(null);
    if (delText !== 'HAPUS') { setDelErr('Ketik HAPUS untuk konfirmasi'); return; }
    setDelBusy(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (!res.ok) { const j = await res.json(); setDelErr(j.error ?? 'Gagal menghapus akun'); return; }
      await supabase.auth.signOut();
      router.replace('/');
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div style={{ padding: '1rem', maxWidth: '560px', margin: '0 auto', paddingBottom: '88px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', color: 'var(--text-primary)' }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={20} color="var(--primary-400)" />
          <h1 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Keamanan Akun</h1>
        </div>
      </div>

      {/* Ganti Password */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <KeyRound size={16} color="var(--primary-400)" />
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Ganti Password</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <input type="password" placeholder="Password lama" value={oldPw} onChange={(e) => setOldPw(e.target.value)} style={inputStyle} autoComplete="current-password" />
          <input type="password" placeholder="Password baru (min. 8 karakter)" value={newPw} onChange={(e) => setNewPw(e.target.value)} style={inputStyle} autoComplete="new-password" />
          <input type="password" placeholder="Konfirmasi password baru" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} style={inputStyle} autoComplete="new-password" />
          {pwMsg && (
            <p style={{ fontSize: '0.75rem', color: pwMsg.ok ? '#22c55e' : '#ef4444', background: pwMsg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>{pwMsg.text}</p>
          )}
          <button onClick={changePassword} disabled={pwBusy} className="btn btn-primary" style={{ width: '100%' }}>
            {pwBusy ? <><Loader2 size={16} className="animate-spin" /> Menyimpan…</> : 'Simpan Password Baru'}
          </button>
        </div>
      </div>

      {/* Keluar semua perangkat */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LogOut size={16} color="var(--text-secondary)" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0 }}>Keluar dari Semua Perangkat</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Mengakhiri semua sesi login aktif.</p>
          </div>
          <button onClick={signOutAll} disabled={signoutBusy} className="btn btn-ghost" style={{ fontSize: '0.8125rem' }}>
            {signoutBusy ? <Loader2 size={14} className="animate-spin" /> : 'Keluar'}
          </button>
        </div>
      </div>

      {/* Hapus Akun (danger zone) */}
      <div className="card" style={{ padding: '1.25rem', border: '1px solid rgba(239,68,68,0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <AlertTriangle size={16} color="#ef4444" />
          <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#ef4444' }}>Hapus Akun</h2>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
          Tindakan ini permanen. Semua data akun Anda akan dihapus dan tidak dapat dikembalikan. Ketik <strong>HAPUS</strong> untuk konfirmasi.
        </p>
        <input type="text" placeholder="Ketik HAPUS" value={delText} onChange={(e) => setDelText(e.target.value)} style={{ ...inputStyle, marginBottom: '0.625rem' }} />
        {delErr && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '0.5rem' }}>{delErr}</p>}
        <button onClick={deleteAccount} disabled={delBusy} className="btn btn-danger" style={{ width: '100%' }}>
          {delBusy ? <><Loader2 size={16} className="animate-spin" /> Menghapus…</> : <><Trash2 size={16} /> Hapus Akun Saya</>}
        </button>
      </div>
    </div>
  );
}
