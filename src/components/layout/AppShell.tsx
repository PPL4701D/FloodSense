'use client';

import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';

/**
 * AppShell — layout wrapper untuk semua halaman (main).
 *
 * Strategi z-index:
 *   z-2000  Header (fixed top)
 *   z-2000  BottomNav (fixed bottom)
 *   z-1000  Kontrol dalam peta (LayerControl, Legend, GPS button)
 *   z-400   Leaflet default controls
 *   z-1     Map tiles / canvas
 *
 * overflow:hidden pada <main> mencegah map (position:absolute) dari
 * membuat scrollbar di level page. Halaman yang butuh scroll harus
 * menggunakan overflow-y:auto di container mereka sendiri.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Header — always on top */}
      <Header />

      {/* Main content area — starts below header, clips overflow */}
      <main
        style={{
          position: 'relative',
          marginTop: '56px',        /* header height */
          paddingBottom: '0px',     /* pages manage their own bottom spacing */
          height: 'calc(100dvh - 56px)',
          overflow: 'hidden',       /* prevent map from creating page scrollbar */
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </main>

      {/* Bottom Nav — always on top */}
      <BottomNav />
    </>
  );
}

