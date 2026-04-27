'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import type { VoteType } from '@/types/database';

interface VoteButtonsProps {
  reportId: string;
  initialUpvotes?: number;
  initialDownvotes?: number;
  initialUserVote?: VoteType | null;
  compact?: boolean;
}

export default function VoteButtons({
  reportId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  initialUserVote = null,
  compact = false,
}: VoteButtonsProps) {
  const { user, isAuthenticated } = useAuth();
  const supabase = createClient();

  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [userVote, setUserVote] = useState<VoteType | null>(initialUserVote);
  const [loading, setLoading] = useState(false);

  // Fetch counts and current user vote on mount
  useEffect(() => {
    let active = true;

    const fetchVoteData = async () => {
      try {
        // Fetch total counts using exactly one query per type, or group by but we can just fire two head queries
        const [upRes, downRes] = await Promise.all([
          supabase.from('votes').select('id', { count: 'exact', head: true }).eq('report_id', reportId).eq('vote_type', 'upvote'),
          supabase.from('votes').select('id', { count: 'exact', head: true }).eq('report_id', reportId).eq('vote_type', 'downvote')
        ]);
        
        if (active && upRes.count !== null) setUpvotes(upRes.count);
        if (active && downRes.count !== null) setDownvotes(downRes.count);

        if (user && initialUserVote === null) {
          const { data } = await supabase
            .from('votes')
            .select('vote_type')
            .eq('report_id', reportId)
            .eq('user_id', user.id)
            .maybeSingle();

          if (active && data) setUserVote(data.vote_type);
        }
      } catch (e) {
        console.error('Failed to fetch vote data:', e);
      }
    };

    fetchVoteData();

    return () => { active = false; };
  }, [user, reportId, supabase, initialUserVote]);

  const handleVote = useCallback(async (type: VoteType) => {
    if (!user || !isAuthenticated || loading) return;

    setLoading(true);

    try {
      if (userVote === type) {
        // Remove the vote
        await supabase
          .from('votes')
          .delete()
          .eq('report_id', reportId)
          .eq('user_id', user.id);

        setUserVote(null);
        if (type === 'upvote') setUpvotes((v) => Math.max(0, v - 1));
        else setDownvotes((v) => Math.max(0, v - 1));
      } else {
        // Upsert the vote
        await supabase
          .from('votes')
          .upsert({
            report_id: reportId,
            user_id: user.id,
            vote_type: type,
          }, { onConflict: 'report_id,user_id' });

        // Adjust counts
        if (userVote === 'upvote') setUpvotes((v) => Math.max(0, v - 1));
        if (userVote === 'downvote') setDownvotes((v) => Math.max(0, v - 1));

        if (type === 'upvote') setUpvotes((v) => v + 1);
        else setDownvotes((v) => v + 1);

        setUserVote(type);
      }

      // Recalculate credibility score (FR-020)
      fetch(`/api/reports/${reportId}/credibility`, { method: 'POST' }).catch(() => {});
    } catch (err) {
      console.error('Vote error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated, loading, userVote, reportId, supabase]);

  const handleUnauthenticatedClick = useCallback(() => {
    alert('Anda harus masuk (login) terlebih dahulu untuk memvalidasi laporan ini.');
  }, []);

  return (
    <div style={{ display: 'flex', gap: compact ? '0.5rem' : '0.75rem', alignItems: 'center' }}>
      {loading && <Loader2 size={12} color="var(--primary-400)" className="animate-spin" />}

      {/* Upvote */}
      <button
        onClick={(e) => { e.stopPropagation(); isAuthenticated ? handleVote('upvote') : handleUnauthenticatedClick(); }}
        disabled={loading}
        title="Valid"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          padding: compact ? '4px 8px' : '6px 10px',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${userVote === 'upvote' ? '#22c55e' : 'var(--border-primary)'}`,
          background: userVote === 'upvote' ? 'rgba(34,197,94,0.12)' : 'transparent',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <ThumbsUp
          size={compact ? 12 : 14}
          color={userVote === 'upvote' ? '#22c55e' : 'var(--text-muted)'}
          fill={userVote === 'upvote' ? '#22c55e' : 'none'}
        />
        <span style={{
          fontSize: compact ? '0.625rem' : '0.75rem',
          fontWeight: userVote === 'upvote' ? 600 : 400,
          color: userVote === 'upvote' ? '#22c55e' : 'var(--text-muted)',
        }}>
          {upvotes}
        </span>
      </button>

      {/* Downvote */}
      <button
        onClick={(e) => { e.stopPropagation(); isAuthenticated ? handleVote('downvote') : handleUnauthenticatedClick(); }}
        disabled={loading}
        title="Tidak valid"
        style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          padding: compact ? '4px 8px' : '6px 10px',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${userVote === 'downvote' ? '#ef4444' : 'var(--border-primary)'}`,
          background: userVote === 'downvote' ? 'rgba(239,68,68,0.12)' : 'transparent',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all var(--transition-fast)',
        }}
      >
        <ThumbsDown
          size={compact ? 12 : 14}
          color={userVote === 'downvote' ? '#ef4444' : 'var(--text-muted)'}
          fill={userVote === 'downvote' ? '#ef4444' : 'none'}
        />
        <span style={{
          fontSize: compact ? '0.625rem' : '0.75rem',
          fontWeight: userVote === 'downvote' ? 600 : 400,
          color: userVote === 'downvote' ? '#ef4444' : 'var(--text-muted)',
        }}>
          {downvotes}
        </span>
      </button>
    </div>
  );
}
