import WaveLoader from '@/components/ui/WaveLoader';

/**
 * Next.js route-level loading UI.
 * Shown automatically during client-side navigation transitions,
 * providing visual feedback instead of a frozen/stuck page.
 */
export default function Loading() {
  return (
    <div style={{
      minHeight: '60dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <WaveLoader size={48} />
    </div>
  );
}
