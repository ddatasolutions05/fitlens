import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

/** The newest note a trainer left for the signed-in member. */
export function useLatestTrainerNote() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['trainer-note', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainer_notes')
        .select('id, note, created_at, trainer_user_id')
        .eq('member_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSendTrainerNote() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { memberUserId: string; note: string }) => {
      const { error } = await supabase.from('trainer_notes').insert({ member_user_id: i.memberUserId, trainer_user_id: userId, note: i.note.trim() });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['trainer-notes-sent'] }),
  });
}

export function useDismissTrainerNote() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trainer_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['trainer-note', userId] }),
  });
}
