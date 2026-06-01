'use client';

/**
 * FR-048 + FR-049 — Komentar & Diskusi Laporan
 *
 * Menampilkan diskusi pada detail laporan. User login dapat menulis komentar
 * (maks 500 char, throttle 10 detik), badge "Pelapor"/"Petugas", soft-delete
 * oleh penulis, dan notifikasi in-app ke pelapor saat ada komentar baru.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { MessageCircle, Send, Trash2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import type { UserRole } from '@/types/database';

interface CommentRow {
  id: string;
  user_id: string;
  body: string;
  is_deleted: boolean;
  created_at: string;
  profiles: { full_name: string; avatar_url: string | null; role: UserRole } | null;
}

const MAX_LEN = 500;
const THROTTLE_MS = 10_000;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Baru saja';
  if (min < 60) return `${min} mnt lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  return `${Math.floor(hr / 24)} hari lalu`;
}

/** Avatar komentar: tampil foto bila valid, fallback ke inisial bila kosong/gagal load. */
function CommentAvatar({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  const showImg = !!url && !broken;
  return (
    <div style={{
      width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
      background: 'var(--bg-elevated)', border: '1px solid var(--border-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-400)',
    }}>
      {showImg ? (
        <img
          src={url as string}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        name.charAt(0).toUpperCase() || '?'
      )}
    </div>
  );
}

export default function CommentSection({
  reportId,
  reporterId,
}: {
  reportId: string;
  reporterId: string;
}) {
  const supabase = createClient();
  const { user, isAuthenticated, profile } = useAuth();

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSentRef = useRef(0);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('report_comments')
      .select('id, user_id, body, is_deleted, created_at, profiles(full_name, avatar_url, role)')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });
    setComments((data as unknown as CommentRow[]) ?? []);
    setLoading(false);
  }, [supabase, reportId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async () => {
    if (!user) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX_LEN) {
      setError(`Maksimal ${MAX_LEN} karakter`);
      return;
    }
    if (Date.now() - lastSentRef.current < THROTTLE_MS) {
      setError('Tunggu beberapa detik sebelum berkomentar lagi');
      return;
    }

    setSubmitting(true);
    setError(null);

    const { data, error: insErr } = await supabase
      .from('report_comments')
      .insert({ report_id: reportId, user_id: user.id, body: trimmed })
      .select('id, user_id, body, is_deleted, created_at, profiles(full_name, avatar_url, role)')
      .single();

    if (insErr) {
      setError('Gagal mengirim komentar');
      setSubmitting(false);
      return;
    }

    lastSentRef.current = Date.now();
    setComments((prev) => [...prev, data as unknown as CommentRow]);
    setBody('');
    setSubmitting(false);

    // FR-049: notifikasi in-app ke pelapor (kecuali komentar dari pelapor sendiri)
    if (reporterId && reporterId !== user.id) {
      await supabase.from('notifications').insert({
        user_id: reporterId,
        type: 'status_change',
        title: 'Komentar Baru di Laporan Anda',
        body: `${profile?.full_name || 'Seseorang'}: ${trimmed.slice(0, 80)}${trimmed.length > 80 ? '…' : ''}`,
        related_report_id: reportId,
      });
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('report_comments').update({ is_deleted: true }).eq('id', id);
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, is_deleted: true } : c)));
  };

  const isStaff = (role?: UserRole) => role === 'staf' || role === 'tlm' || role === 'admin';

  return (
    <div>
      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <MessageCircle size={16} color="var(--primary-400)" />
        Diskusi {comments.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({comments.length})</span>}
      </h3>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
          <Loader2 size={18} className="animate-spin" color="var(--text-muted)" />
        </div>
      ) : comments.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.5rem 0 1rem' }}>
          Belum ada komentar. Jadilah yang pertama menambahkan informasi.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {comments.map((c) => {
            const isReporter = c.user_id === reporterId;
            const staff = isStaff(c.profiles?.role);
            const canDelete = user && c.user_id === user.id && !c.is_deleted;
            return (
              <div key={c.id} style={{ display: 'flex', gap: '0.625rem' }}>
                <CommentAvatar url={c.profiles?.avatar_url ?? null} name={c.profiles?.full_name || 'Pengguna'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{c.profiles?.full_name || 'Pengguna'}</span>
                    {isReporter && (
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--primary-400)', background: 'rgba(59,130,246,0.12)', padding: '1px 5px', borderRadius: '4px' }}>PELAPOR</span>
                    )}
                    {staff && (
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '1px 5px', borderRadius: '4px' }}>PETUGAS</span>
                    )}
                    <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>· {timeAgo(c.created_at)}</span>
                    {canDelete && (
                      <button onClick={() => handleDelete(c.id)} title="Hapus" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                        <Trash2 size={12} color="var(--text-muted)" />
                      </button>
                    )}
                  </div>
                  <p style={{
                    fontSize: '0.8125rem', margin: '2px 0 0', lineHeight: 1.45,
                    color: c.is_deleted ? 'var(--text-muted)' : 'var(--text-secondary)',
                    fontStyle: c.is_deleted ? 'italic' : 'normal',
                  }}>
                    {c.is_deleted ? 'Komentar dihapus' : c.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      {isAuthenticated ? (
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); setError(null); }}
              maxLength={MAX_LEN}
              rows={2}
              placeholder="Tambahkan informasi atau konfirmasi kondisi…"
              className="input"
              style={{ flex: 1, resize: 'vertical', minHeight: '40px', fontFamily: 'inherit' }}
            />
            <button
              onClick={handleSubmit}
              disabled={submitting || !body.trim()}
              className="btn btn-primary"
              style={{ padding: '0.6rem', opacity: submitting || !body.trim() ? 0.6 : 1 }}
              title="Kirim"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            {error ? (
              <span style={{ fontSize: '0.6875rem', color: '#ef4444' }}>{error}</span>
            ) : <span />}
            <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{body.length}/{MAX_LEN}</span>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <Link href="/login" style={{ color: 'var(--primary-400)', fontWeight: 600 }}>Masuk</Link> untuk ikut berdiskusi.
        </p>
      )}
    </div>
  );
}
