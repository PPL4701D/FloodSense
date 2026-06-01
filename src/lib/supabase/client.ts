import { createBrowserClient } from '@supabase/ssr';

/**
 * Bypass navigator.locks untuk auth token.
 *
 * Default @supabase/auth-js mengunci token via Web Locks API
 * (lock:sb-<ref>-auth-token). Saat soft-refresh / navigasi balik, halaman lama
 * bisa masuk bfcache TANPA melepas lock → getSession() hang selamanya
 * → UI stuck "loading" + tampak tidak login (hanya pulih dengan hard refresh).
 *
 * Lock no-op ini menjalankan callback langsung tanpa Web Locks, sehingga tidak
 * pernah deadlock. Trade-off: refresh token antar-tab tidak diserialisasi
 * (aman untuk aplikasi ini).
 */
const clientOptions = {
  auth: {
    lock: async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn(),
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
