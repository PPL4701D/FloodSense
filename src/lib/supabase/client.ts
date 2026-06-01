import { createBrowserClient } from '@supabase/ssr';
import { processLock } from '@supabase/auth-js';

/**
 * Pakai processLock (lock in-memory) sebagai pengganti default navigatorLock.
 *
 * Default @supabase/auth-js mengunci token via Web Locks API
 * (lock:sb-<ref>-auth-token). Saat soft-refresh / navigasi client-side, halaman
 * lama bisa masuk bfcache TANPA melepas lock → getSession() hang selamanya
 * → UI stuck "loading" + tampak tidak login (hanya pulih dengan hard refresh).
 *
 * processLock TETAP men-serialisasi operasi auth di dalam tab (mencegah race
 * saat banyak getSession bersamaan, mis. di halaman /reports), TAPI tidak
 * memakai Web Locks API sehingga tidak pernah deadlock lintas-konteks/bfcache.
 */
const clientOptions = {
  auth: {
    lock: processLock,
  },
};

export function createClient() {
  // Use a singleton on the browser side to avoid creating multiple instances
  // which can cause memory leaks and infinite re-render loops in React.
  if (typeof window !== 'undefined') {
    if (!(window as any)._supabaseBrowserClient) {
      (window as any)._supabaseBrowserClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        clientOptions
      );
    }
    return (window as any)._supabaseBrowserClient;
  }

  // Fallback for SSR where we shouldn't share instances across requests (though this is typically only called in client components)
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    clientOptions
  );
}
