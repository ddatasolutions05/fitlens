// Trainer access: a member links to a trainer with a six-character code and can
// revoke it; the trainer reads weekly summaries through a database function.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import { supabase } from '@/lib/supabase';

export function useTrainerCode() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['trainer-code', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainer_codes').select('code, expires_at').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMakeTrainerCode() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('make_trainer_code');
      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['trainer-code', userId] }),
  });
}

export function useTrainerMembers(days = 7) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['trainer-members', userId, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('trainer_members', { p_days: days });
      if (error) throw error;
      return data;
    },
  });
}

export function useMyTrainers() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['my-trainers', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainer_links').select('id, trainer_name, status, created_at').eq('member_user_id', userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export class TrainerCodeError extends Error {}

export function useLinkTrainer() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('link_trainer', { p_code: code.trim().toUpperCase() });
      if (error) {
        if (/code_not_found/.test(error.message)) throw new TrainerCodeError('That code is not valid or has expired. Ask your trainer for a fresh one.');
        if (/own_code/.test(error.message)) throw new TrainerCodeError('That is your own trainer code.');
        throw error;
      }
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-trainers', userId] }),
  });
}

export function useRevokeTrainer() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from('trainer_links').update({ status: 'revoked' }).eq('id', linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-trainers', userId] });
      void qc.invalidateQueries({ queryKey: ['trainer-members'] });
    },
  });
}
