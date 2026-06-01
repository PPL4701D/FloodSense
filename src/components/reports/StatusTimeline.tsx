'use client';

/**
 * FR-053 — Status Timeline
 *
 * Linimasa vertikal perjalanan status laporan (Dibuat → Ditinjau → Verified/Rejected)
 * beserta catatan petugas & timestamp WIB. Data dari GET /api/reports/[id]/timeline.
 */

import { useEffect, useState } from 'react';
import {
  FileText, Clock, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';

type TimelineEvent = {
  key: string;
  label: string;
  at: string;
  note: string | null;
  kind: 'created' | 'scheduled_check' | 'verified' | 'rejected';
};

const KIND_STYLE: Record<TimelineEvent['kind'], { icon: typeof FileText; color: string }> = {
  created: { icon: FileText, color: 'var(--primary-400)' },
  scheduled_check: { icon: Clock, color: '#eab308' },
  verified: { icon: CheckCircle2, color: '#22c55e' },
  rejected: { icon: XCircle, color: '#ef4444' },
};

function formatWIB(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }) + ' WIB';
}

export default function StatusTimeline({ reportId }: { reportId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/timeline`);
        if (!res.ok) throw new Error('failed');
        const json = await res.json();
        if (!active) return;
        const evs: TimelineEvent[] = json.events ?? [];
        setEvents(evs);
        // Belum ada keputusan akhir → tampilkan node "menunggu"
        const hasDecision = evs.some((e) => e.kind === 'verified' || e.kind === 'rejected');
        setPending(!hasDecision);
      } catch {
        if (active) setEvents([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [reportId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem 0' }}>
        <Loader2 size={20} className="animate-spin" color="var(--text-muted)" />
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div style={{ marginTop: '1rem' }}>
      <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.875rem' }}>Linimasa Status</h3>
      <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
        {/* garis vertikal */}
        <div style={{
          position: 'absolute', left: '7px', top: '6px', bottom: '6px',
          width: '2px', background: 'var(--border-primary)',
        }} />

        {events.map((e, idx) => {
          const { icon: Icon, color } = KIND_STYLE[e.kind];
          const isLast = idx === events.length - 1 && !pending;
          return (
            <div key={e.key} style={{ position: 'relative', paddingBottom: idx === events.length - 1 && !pending ? 0 : '1.25rem' }}>
              <div style={{
                position: 'absolute', left: '-1.5rem', top: '0',
                width: '16px', height: '16px', borderRadius: '50%',
                background: 'var(--bg-primary)', border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isLast ? `0 0 0 4px ${color}22` : 'none',
              }}>
                <Icon size={9} color={color} />
              </div>
              <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {e.label}
              </p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {formatWIB(e.at)}
              </p>
              {e.note && (
                <p style={{
                  fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.375rem 0 0',
                  padding: '0.5rem 0.625rem', background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)', lineHeight: 1.4,
                }}>
                  &ldquo;{e.note}&rdquo;
                </p>
              )}
            </div>
          );
        })}

        {pending && (
          <div style={{ position: 'relative' }}>
            <div style={{
              position: 'absolute', left: '-1.5rem', top: '0',
              width: '16px', height: '16px', borderRadius: '50%',
              background: 'var(--bg-primary)', border: '2px dashed var(--text-muted)',
            }} />
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>
              Menunggu Verifikasi
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
