'use client';

/**
 * FR-051 — Reputation Badge
 *
 * Lencana tier reputasi. `showProgress` menampilkan progress bar menuju tier
 * berikutnya (dipakai di halaman profil); mode mini dipakai di samping nama author.
 */

import { Award } from 'lucide-react';
import { getBadgeTier, tierProgress } from '@/lib/utils/reputation';

interface Props {
  score: number;
  size?: 'mini' | 'normal';
  showProgress?: boolean;
}

export default function ReputationBadge({ score, size = 'normal', showProgress = false }: Props) {
  const tier = getBadgeTier(score);

  if (size === 'mini') {
    return (
      <span
        title={`${tier.label} · ${score} poin`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          padding: '1px 6px', borderRadius: '6px',
          background: `${tier.color}1a`, border: `1px solid ${tier.color}40`,
          fontSize: '0.625rem', fontWeight: 700, color: tier.color, lineHeight: 1.4,
        }}
      >
        <Award size={10} /> {tier.label}
      </span>
    );
  }

  const progress = tierProgress(score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            padding: '4px 10px', borderRadius: 'var(--radius-sm)',
            background: `${tier.color}1a`, border: `1px solid ${tier.color}55`,
            fontSize: '0.75rem', fontWeight: 700, color: tier.color,
          }}
        >
          <Award size={13} /> {tier.label}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{score} poin</span>
      </div>

      {showProgress && tier.next !== null && (
        <div>
          <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(progress * 100)}%`, height: '100%', background: tier.color, transition: 'width var(--transition-base)' }} />
          </div>
          <p style={{ fontSize: '0.625rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>
            {tier.next - score} poin lagi menuju tier berikutnya
          </p>
        </div>
      )}
    </div>
  );
}
