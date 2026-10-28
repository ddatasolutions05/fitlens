import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { deviceTimeZone, exifDateTimeOriginal, exifDateToIso } from '@fitlens/core';

import { config } from '@/lib/config';
import { supabase } from '@/lib/supabase';

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  /** When the picture was taken: the moment of capture for the camera, the EXIF time for a gallery pick, else null. */
  takenAt: string | null;
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
  // exif is read for the capture time only; the object is dropped right after and never stored or uploaded.
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: source === 'library', allowsMultipleSelection: false };
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
  try {
    const takenAt = source === 'camera' ? new Date().toISOString() : await takenAtFor(asset);
    return { ...(await resizeToJpeg(asset.uri, asset.width, asset.height)), takenAt };
  } catch (err) {
    if (err instanceof CaptureFailure) throw err;
    throw new CaptureFailure('failed', err instanceof Error ? err.message : String(err));
  }
}

async function takenAtFor(asset: ImagePicker.ImagePickerAsset): Promise<string | null> {
  const tz = deviceTimeZone();
  const fromExif = typeof asset.exif?.DateTimeOriginal === 'string' ? asset.exif.DateTimeOriginal : typeof asset.exif?.DateTime === 'string' ? asset.exif.DateTime : null;
  if (fromExif) return exifDateToIso(fromExif, tz);
  if (Platform.OS !== 'web') return null;
  try {
    const bytes = new Uint8Array(await (await fetch(asset.uri)).arrayBuffer());
    const tag = exifDateTimeOriginal(bytes);
    if (tag) return exifDateToIso(tag, tz);
  } catch {
    // Unreadable bytes; fall through to the file date.
  }
  // Browsers that strip EXIF on pick usually keep the file's own date. Ignore
  // it when it is within a minute of now, which means it is the pick time.
  const modified = (asset as { file?: { lastModified?: number } }).file?.lastModified;
  if (typeof modified === 'number' && modified > 0 && Date.now() - modified > 60_000) return new Date(modified).toISOString();
  return null;
}

type ResizedPhoto = Omit<CapturedPhoto, 'takenAt'>;

export async function resizeToJpeg(uri: string, width: number, height: number): Promise<ResizedPhoto> {
  if (Platform.OS === 'web') return resizeOnWeb(uri);
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

// Browsers cap canvas size (iOS Safari: about 16.7 million pixels), and a phone
// camera photo is larger than that. Drawing the picture straight into a canvas
// no bigger than the target size stays under the cap on every browser.
async function resizeOnWeb(uri: string): Promise<ResizedPhoto> {
  const image = await loadImage(uri);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new CaptureFailure('failed', 'Could not read the image size');
  const scale = Math.min(1, config.photoMaxPx / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new CaptureFailure('failed', 'Canvas is not available in this browser');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new CaptureFailure('failed', 'Could not encode the photo');
  return { uri: URL.createObjectURL(blob), width, height };
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new CaptureFailure('failed', 'Could not open the image'));
    image.src = uri;
  });
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
