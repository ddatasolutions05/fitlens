import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';

export interface Reminder {
  enabled: boolean;
  /** HH:MM:SS from the database. */
  local_time: string;
  last_sent_on: string | null;
}

export function useReminder() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['reminder', userId],
    queryFn: async (): Promise<Reminder | null> => {
      const { data, error } = await supabase.from('reminders').select('enabled, local_time, last_sent_on').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveReminder() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { enabled: boolean; local_time: string }) => {
      const { error } = await supabase.from('reminders').upsert({ user_id: userId, enabled: input.enabled, local_time: input.local_time }, { onConflict: 'user_id' });
      if (error) throw error;
      track(input.enabled ? 'reminder_on' : 'reminder_off');
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reminder', userId] }),
  });
}

export function useSendTestReminder() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-reminders', { method: 'POST', body: { test: true } });
      if (error) {
        const res = (error as { context?: Response }).context;
        if (res) {
          const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
          if (body?.error?.message) throw new Error(body.error.message);
        }
        throw error;
      }
      return data as { sent: number; removed: number; failed: number };
    },
  });
}
