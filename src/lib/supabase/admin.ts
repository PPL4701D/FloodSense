import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase client using the service role key.
 * This bypasses RLS — use ONLY in server-side API routes.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[AdminClient] CRITICAL: Missing env vars!', {
      hasUrl: !!url,
      hasKey: !!key,
    });
  }

  return createClient(
    url!,
    key!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
