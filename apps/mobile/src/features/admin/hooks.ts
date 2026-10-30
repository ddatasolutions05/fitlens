// Owner's overview. Access is decided by app_admins on the server; the client
// only asks and renders.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
  first_source: string | null;
  last_place: string | null;
  reminder_on: boolean | null;
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
    visits_recent: number;
    visitors_recent: number;
    reminders_on: number;
  };
  users: AdminUser[];
  errors: AdminError[];
  events: { name: string; count: number; people: number }[];
  misses: { query: string; count: number; people: number; last_at: string }[];
  visits: AdminVisit[];
  sources: { source: string; visits: number; visitors: number; signed_in: number; last_at: string }[];
  places: { city: string; region: string; country: string; visits: number; visitors: number }[];
}

export interface AdminVisit {
  id: string;
  created_at: string;
  visitor_id: string;
  source: string | null;
  campaign: string | null;
  referrer: string | null;
  path: string | null;
  platform: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  user_agent: string | null;
  email: string | null;
  display_name: string | null;
}

export function useAdminAlerts() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['admin-alerts', userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_alert_settings');
      if (error) throw error;
      return (data as { alerts: boolean; alerted_at: string | null } | null) ?? null;
    },
  });
}

export function useSetAdminAlerts() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (on: boolean) => {
      const { error } = await supabase.rpc('set_admin_alerts', { p_on: on });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-alerts', userId] }),
  });
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
