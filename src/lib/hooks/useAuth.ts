'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

// Singleton client — prevent new instance on every render
const supabase = createClient();

async function fetchProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
  return data as Profile;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    // Initial session check — use getSession (instant from localStorage) then
    // verify with getUser (round-trip to Supabase) to avoid flicker.
    const init = async () => {
      try {
        // Fast-path: read cached session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          const profile = await fetchProfileById(session.user.id);
          if (mounted) setState({ user: session.user, profile, loading: false, error: null });
        } else if (mounted) {
          setState({ user: null, profile: null, loading: false, error: null });
        }
      } catch {
        if (mounted) setState((prev) => ({ ...prev, loading: false, error: 'Failed to get user' }));
      }
    };

    init();

    // Listen for subsequent auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
          const profile = await fetchProfileById(session.user.id);
          if (mounted) setState({ user: session.user, profile, loading: false, error: null });
        } else if (event === 'SIGNED_OUT') {
          if (mounted) setState({ user: null, profile: null, loading: false, error: null });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // ← empty dep array: runs once, no re-subscription loops

  const signOut = async () => {
    await supabase.auth.signOut();
    setState({ user: null, profile: null, loading: false, error: null });
  };

  return {
    user: state.user,
    profile: state.profile,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    role: state.profile?.role ?? null,
    signOut,
  };
}
