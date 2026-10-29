// Owner's overview. Access is decided by app_admins on the server; the client
// only asks and renders.
import { useQuery } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

export interface AdminUser {
  user_id: string;
  email: string | null;
  phone: string | null;
  provider: string;
  signed_up_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  onboarding_completed_at: string | null;
  meals: number;
  meals_recent: number;
  photos: number;
  weights: number;
  activity: number;
  water: number;
  coach_calls: number;
  analyses: number;
  errors_recent: number;
  last_active_at: string | null;
}

export interface AdminError {
  id: string;
  created_at: string;
  scope: string;
  message: string;
  platform: string | null;
  route: string | null;
  app_version: string | null;
  email: string | null;
}

export interface AdminOverview {
  days: number;
  generated_at: string;
  totals: {
    accounts: number;
    onboarded: number;
    logged_a_meal: number;
    signed_in_recent: number;
    meals_recent: number;
    errors_recent: number;
    coach_calls_recent: number;
    analyses_recent: number;
    search_misses_recent: number;
  };
  users: AdminUser[];
  errors: AdminError[];
  events: { name: string; count: number; people: number }[];
  misses: { query: string; count: number; people: number; last_at: string }[];
}

export function useIsAdmin() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['is-admin', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return data === true;
    },
    staleTime: 5 * 60_000,
  });
}

export function useAdminOverview(days: number, enabled: boolean) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['admin-overview', userId, days],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_overview', { p_days: days });
      if (error) throw error;
      return data as unknown as AdminOverview;
    },
  });
}
