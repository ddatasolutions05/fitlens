import { useQuery } from '@tanstack/react-query';
import { featuresResultSchema, type FeaturesResult } from '@fitlens/schemas';

import { supabase } from '@/lib/supabase';

export const unreachableFeatures: FeaturesResult = {
  vision: { configured: false, provider: null, model: null, reason: 'Feature service unreachable. Deploy the edge functions and check the project URL.' },
  coach: { configured: false, reason: 'Feature service unreachable.' },
  fdc_branded: { configured: false, reason: 'Feature service unreachable.' },
  barcode: { configured: true },
  daily_ai_limit: 30,
};

/** Which optional services the deployed functions have credentials for. */
export function useFeatures() {
  return useQuery({
    queryKey: ['features'],
    queryFn: async (): Promise<FeaturesResult> => {
      const { data, error } = await supabase.functions.invoke('features', { method: 'GET' });
      if (error) throw error;
      return featuresResultSchema.parse(data);
    },
    staleTime: 10 * 60_000,
    retry: 1,
  });
}
