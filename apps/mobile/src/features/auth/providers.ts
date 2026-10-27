import { useQuery } from '@tanstack/react-query';

import { config } from '@/lib/config';

export interface AuthProviders {
  email: boolean;
  google: boolean;
  apple: boolean;
  signupDisabled: boolean;
  /** True when sign-ups do not need an email confirmation click. */
  autoconfirm: boolean;
}

/** Reads the project's public auth settings so the sign-in screen shows only enabled providers. */
export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth-providers', config.supabaseUrl],
    queryFn: async (): Promise<AuthProviders> => {
      const res = await fetch(`${config.supabaseUrl}/auth/v1/settings`, { headers: { apikey: config.supabaseAnonKey } });
      if (!res.ok) throw new Error(`Auth settings unavailable (${res.status})`);
      const data = (await res.json()) as { external?: Record<string, boolean>; disable_signup?: boolean; mailer_autoconfirm?: boolean };
      return {
        email: data.external?.email ?? true,
        google: data.external?.google ?? false,
        apple: data.external?.apple ?? false,
        signupDisabled: data.disable_signup ?? false,
        autoconfirm: data.mailer_autoconfirm ?? false,
      };
    },
    staleTime: 10 * 60_000,
    enabled: config.supabaseConfigured,
  });
}
