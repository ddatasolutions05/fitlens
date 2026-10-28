// Profile picture: a private object at avatars/<user_id>/avatar.jpg, shown
// through a short-lived signed URL, with initials until one is set.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Pressable, View } from 'react-native';

import { useUserId } from '@/features/auth/session';
import { resizeToJpeg } from '@/features/photo/capture';
import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { Icon, Text, fonts, radius, toast, useTheme } from '@/ui';

import { useUpsertProfile } from './hooks';

const AVATAR_PX = 512;

export function useAvatarUrl(path: string | null) {
  return useQuery({
    queryKey: ['avatar-url', path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path as string, config.signedUrlSeconds);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: Boolean(path),
    staleTime: (config.signedUrlSeconds - 30) * 1000,
    gcTime: config.signedUrlSeconds * 1000,
  });
}

export class AvatarCancelled extends Error {}

/** Picks a photo, squares and shrinks it on the device, uploads it and records the path. */
export function useUploadAvatar() {
  const userId = useUserId();
  const qc = useQueryClient();
  const upsert = useUpsertProfile();
  return useMutation({
    mutationFn: async () => {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) throw new Error('Photo access was denied. Allow it in your device settings.');
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false, allowsEditing: true, aspect: [1, 1] });
      if (result.canceled || !result.assets?.[0]) throw new AvatarCancelled('cancelled');
      const asset = result.assets[0];
      const resized = await resizeToJpeg(asset.uri, asset.width, asset.height, AVATAR_PX);
      const blob = await (await fetch(resized.uri)).blob();
      const path = `${userId}/avatar.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      await upsert.mutateAsync({ avatar_path: path });
      return path;
    },
    onSuccess: (path) => {
      toast('Picture updated');
      void qc.invalidateQueries({ queryKey: ['avatar-url', path] });
    },
  });
}

export function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name ?? '').trim() || (email ?? '').split('@')[0] || '';
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function Avatar({ path, initials, size = 64, onPress, editable = false, testID }: { path: string | null; initials: string; size?: number; onPress?: () => void; editable?: boolean; testID?: string }) {
  const { colors } = useTheme();
  const url = useAvatarUrl(path);
  const body = (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.inverse, alignItems: 'center', justifyContent: 'center' }}>
      {url.data ? (
        <Image source={{ uri: url.data }} style={{ width: size, height: size }} contentFit="cover" accessibilityLabel="Your profile picture" transition={0} />
      ) : initials ? (
        <Text style={{ color: colors.onInverse, fontFamily: fonts.black, fontSize: size * 0.38, lineHeight: size * 0.46 }}>{initials}</Text>
      ) : (
        <Icon name="profile" size={size * 0.5} color={colors.onInverse} />
      )}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={editable ? 'Change profile picture' : 'Open profile'} onPress={onPress} testID={testID} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
      {editable ? (
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="pencil" size={13} />
        </View>
      ) : null}
    </Pressable>
  );
}
