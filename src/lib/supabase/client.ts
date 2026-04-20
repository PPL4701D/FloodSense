import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  // Use a singleton on the browser side to avoid creating multiple instances
  // which can cause memory leaks and infinite re-render loops in React.
  if (typeof window !== 'undefined') {
    if (!(window as any)._supabaseBrowserClient) {
      (window as any)._supabaseBrowserClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
    return (window as any)._supabaseBrowserClient;
  }

  // Fallback for SSR where we shouldn't share instances across requests (though this is typically only called in client components)
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
