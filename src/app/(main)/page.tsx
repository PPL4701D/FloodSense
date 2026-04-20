'use client';

import dynamic from 'next/dynamic';
import WaveLoader from '@/components/ui/WaveLoader';

const LOADING_HEIGHT = 'calc(100dvh - 56px)';

const FloodMap = dynamic(() => import('@/components/map/FloodMap'), {
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: '1rem',
    }}>
      <WaveLoader size={48} />
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Memuat peta banjir...
      </p>
    </div>
  ),
});

export default function HomePage() {
  return (
    /*
     * Map container: Fill the main area entirely (including bottom padding space)
     * so that the map renders behind the floating BottomNav.
     */
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    }}>
      <FloodMap />
    </div>
  );
}
