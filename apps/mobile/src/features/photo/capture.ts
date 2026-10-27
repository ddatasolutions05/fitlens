import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

export type CaptureError = 'permission_denied' | 'cancelled' | 'unsupported' | 'failed';

export class CaptureFailure extends Error {
  constructor(
    public readonly reason: CaptureError,
    message?: string,
  ) {
    super(message ?? reason);
  }
}

/** Opens the camera or the library and returns a JPEG resized to at most 1,600 px. */
export async function pickPhoto(source: 'camera' | 'library'): Promise<CapturedPhoto> {
  if (Platform.OS !== 'web') {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new CaptureFailure('permission_denied');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false, allowsMultipleSelection: false };
  let result: ImagePicker.ImagePickerResult;
  try {
    result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  } catch (err) {
    throw new CaptureFailure('failed', err instanceof Error ? err.message : String(err));
  }
  if (result.canceled || !result.assets?.[0]) throw new CaptureFailure('cancelled');
  const asset = result.assets[0];
  if (asset.mimeType && !/^image\/(jpeg|jpg|png|heic|heif|webp)$/i.test(asset.mimeType)) {
    throw new CaptureFailure('unsupported', `Unsupported image type ${asset.mimeType}`);
  }
  return resizeToJpeg(asset.uri, asset.width, asset.height);
}

export async function resizeToJpeg(uri: string, width: number, height: number): Promise<CapturedPhoto> {
  const longest = Math.max(width || 0, height || 0);
  const context = ImageManipulator.ImageManipulator.manipulate(uri);
  if (longest > config.photoMaxPx) {
    if (width >= height) context.resize({ width: config.photoMaxPx, height: null });
    else context.resize({ width: null, height: config.photoMaxPx });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

export interface UploadedPhoto {
  storagePath: string;
  bytes: number;
  width: number;
  height: number;
}

export async function uploadPhoto(userId: string, mealId: string, photo: CapturedPhoto): Promise<UploadedPhoto> {
  const response = await fetch(photo.uri);
  const blob = await response.blob();
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const storagePath = `${userId}/${mealId}/${name}`;
  const { error } = await supabase.storage.from('meal-photos').upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return { storagePath, bytes: blob.size, width: photo.width, height: photo.height };
}
