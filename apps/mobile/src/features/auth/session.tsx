import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { config } from '@/lib/config';
import { getSupabase } from '@/lib/supabase';

export interface SessionState {
  session: Session | null;
  loading: boolean;
  userId: string | null;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
  userId: null,
  signOut: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(config.supabaseConfigured);

  useEffect(() => {
    if (!config.supabaseConfigured) return;
    const supabase = getSupabase();
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      session,
      loading,
      userId: session?.user.id ?? null,
      signOut: async () => {
        await getSupabase().auth.signOut();
      },
    }),
    [session, loading],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}

/** The signed-in user's id. Throws when used outside an authenticated screen. */
export function useUserId(): string {
  const { userId } = useSession();
  if (!userId) throw new Error('No signed-in user');
  return userId;
}
