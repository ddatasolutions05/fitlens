import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { View } from 'react-native';

import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { radius, useTheme } from '@/ui';

export function useSignedPhotoUrl(storagePath: string | null) {
  return useQuery({
    queryKey: ['photo-url', storagePath],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('meal-photos').createSignedUrl(storagePath as string, config.signedUrlSeconds);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: Boolean(storagePath),
    staleTime: (config.signedUrlSeconds - 30) * 1000,
    gcTime: config.signedUrlSeconds * 1000,
  });
}

export function MealPhotoThumb({ storagePath, size = 56, localUri }: { storagePath: string | null; size?: number; localUri?: string | null }) {
  const { colors } = useTheme();
  const url = useSignedPhotoUrl(localUri ? null : storagePath);
  const source = localUri ?? url.data ?? null;
  return (
    <View style={{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
      {source ? (
        <Image source={{ uri: source }} style={{ width: size, height: size }} contentFit="cover" accessibilityLabel="Meal photo" transition={0} />
      ) : null}
    </View>
  );
}
