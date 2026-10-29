// Body measurements: waist, hips, an optional private progress photo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from '@/features/auth/session';
import { resizeToJpeg } from '@/features/photo/capture';
import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';

export interface MeasurementRow {
  id: string;
  measured_at: string;
  local_date: string;
  tz: string;
  waist_cm: number | null;
  hips_cm: number | null;
  photo_path: string | null;
  note: string | null;
}

const PHOTO_PX = 1200;

export function useMeasurements(limit = 60) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['measurements', userId, limit],
    queryFn: async (): Promise<MeasurementRow[]> => {
      const { data, error } = await supabase.from('measurements').select('id, measured_at, local_date, tz, waist_cm, hips_cm, photo_path, note').eq('user_id', userId).order('local_date', { ascending: false }).limit(limit);
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, waist_cm: r.waist_cm == null ? null : Number(r.waist_cm), hips_cm: r.hips_cm == null ? null : Number(r.hips_cm) }));
    },
  });
}

export function usePhotoUrls(paths: string[]) {
  return useQuery({
    queryKey: ['body-photo-urls', paths],
    enabled: paths.length > 0,
    staleTime: (config.signedUrlSeconds - 30) * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from('body-photos').createSignedUrls(paths, config.signedUrlSeconds);
      if (error) throw error;
      const out: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
      return out;
    },
  });
}

export interface LogMeasurementInput {
  localDate: string;
  tz: string;
  measuredAt: string;
  waistCm: number | null;
  hipsCm: number | null;
  note: string | null;
  photo: { uri: string; width: number; height: number } | null;
}

export function useLogMeasurement() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LogMeasurementInput) => {
      let photoPath: string | null = null;
      if (input.photo) {
        const resized = await resizeToJpeg(input.photo.uri, input.photo.width, input.photo.height, PHOTO_PX);
        const blob = await (await fetch(resized.uri)).blob();
        photoPath = `${userId}/${input.localDate}-${crypto.randomUUID().slice(0, 8)}.jpg`;
        const { error } = await supabase.storage.from('body-photos').upload(photoPath, blob, { contentType: 'image/jpeg', upsert: false });
        if (error) throw error;
      }
      const { error } = await supabase.from('measurements').insert({
        user_id: userId,
        local_date: input.localDate,
        tz: input.tz,
        measured_at: input.measuredAt,
        waist_cm: input.waistCm,
        hips_cm: input.hipsCm,
        photo_path: photoPath,
        note: input.note,
      });
      if (error) throw error;
      track('measurement_logged', { photo: photoPath != null, waist: input.waistCm != null });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['measurements', userId] }),
  });
}

export function useDeleteMeasurement() {
  const userId = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { id: string; photo_path: string | null }) => {
      if (row.photo_path) await supabase.storage.from('body-photos').remove([row.photo_path]);
      const { error } = await supabase.from('measurements').delete().eq('id', row.id).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['measurements', userId] }),
  });
}
