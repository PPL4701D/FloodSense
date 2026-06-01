'use client';

/**
 * FR-052 — Papan Peringkat Kontributor
 *
 * Menampilkan kontributor teratas berdasarkan reputation_score. Posisi pengguna
 * sendiri di-highlight walau di luar top-N. profiles dapat dibaca publik (RLS
 * profiles_select_public).
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import WaveLoader from '@/components/ui/WaveLoader';
import ReputationBadge from '@/components/reputation/ReputationBadge';
import { Trophy, Medal } from 'lucide-react';

interface Contributor {
  id: string;
  full_name: string;
  avatar_url: string | null;
  reputation_score: number;
}

const TOP_LIMIT = 50;

function rankColor(rank: number): string {
  if (rank === 1) return '#f59e0b';
  if (rank === 2) return '#94a3b8';
  if (rank === 3) return '#b45309';
  return 'var(--text-muted)';
}

export default function LeaderboardPage() {
  const supabase = createClient();
  const { user } = useAuth();
  const [list, setList] = useState<Contributor[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [me, setMe] = useState<Contributor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, reputation_score')
        .order('reputation_score', { ascending: false })
        .limit(TOP_LIMIT);
      const rows = (data as Contributor[]) ?? [];
      setList(rows);

      if (user) {
        const idx = rows.findIndex((r) => r.id === user.id);
        if (idx >= 0) {
          setMyRank(idx + 1);
          setMe(rows[idx]);
        } else {
          // Hitung peringkat di luar top-N
          const { data: mine } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, reputation_score')
            .eq('id', user.id)
            .maybeSingle();
          if (mine) {
            const { count } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .gt('reputation_score', (mine as Contributor).reputation_score);
            setMyRank((count ?? 0) + 1);
            setMe(mine as Contributor);
          }
        }
      }
      setLoading(false);
    })();
  }, [supabase, user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
        <WaveLoader size={48} />
      </div>
    );
  }

  const renderRow = (c: Contributor, rank: number, highlight: boolean) => (
    <div
      key={c.id}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-lg)',
        background: highlight ? 'rgba(59,130,246,0.12)' : 'var(--bg-card)',
        border: `1px solid ${highlight ? 'var(--primary-400)' : 'var(--border-primary)'}`,
      }}
    >
      <div style={{ width: '28px', textAlign: 'center', flexShrink: 0 }}>
        {rank <= 3 ? (
          <Medal size={20} color={rankColor(rank)} />
        ) : (
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-muted)' }}>{rank}</span>
        )}
      </div>
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        background: 'var(--bg-elevated)', border: '2px solid var(--primary-500)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-400)',
      }}>
        {c.avatar_url ? (
          <img src={c.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          c.full_name?.charAt(0)?.toUpperCase() || '?'
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.full_name || 'Pengguna'} {highlight && <span style={{ color: 'var(--primary-400)', fontSize: '0.6875rem' }}>(Anda)</span>}
        </p>
        <div style={{ marginTop: '2px' }}>
          <ReputationBadge score={c.reputation_score} size="mini" />
        </div>
      </div>
      <span style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--primary-400)', flexShrink: 0 }}>
        {c.reputation_score}
      </span>
    </div>
  );

  const selfInTop = myRank !== null && myRank <= list.length && list.some((r) => r.id === user?.id);

  return (
    <div style={{ padding: '1rem', maxWidth: '640px', margin: '0 auto', paddingBottom: '88px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Trophy size={20} color="#f59e0b" />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Papan Peringkat</h1>
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Kontributor paling tepercaya berdasarkan poin reputasi dari laporan terverifikasi.
      </p>

      {list.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>Belum ada kontributor</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {list.map((c, i) => renderRow(c, i + 1, c.id === user?.id))}

          {/* Posisi pengguna di luar top-N */}
          {me && myRank !== null && !selfInTop && (
            <>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0.25rem 0' }}>• • •</p>
              {renderRow(me, myRank, true)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
