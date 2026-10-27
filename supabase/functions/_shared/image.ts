// Removes metadata segments (EXIF, XMP, ICC, comments) from a JPEG without
// touching image data. The client already re-encodes to a fresh JPEG; this is
// the server-side guarantee that no GPS or camera data reaches storage or the
// provider.
export function stripJpegMetadata(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const out: Uint8Array<ArrayBuffer>[] = [bytes.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1]!;
    if (marker === 0xda) {
      // Start of scan: the rest is entropy-coded data and the EOI marker.
      out.push(bytes.subarray(i));
      i = bytes.length;
      break;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(bytes.subarray(i, i + 2));
      i += 2;
      continue;
    }
    const len = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    const end = i + 2 + len;
    const isMetadata = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!isMetadata) out.push(bytes.subarray(i, end));
    i = end;
  }
  if (i < bytes.length) out.push(bytes.subarray(i));
  const total = out.reduce((n, p) => n + p.length, 0);
  const result = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const part of out) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function sniffMime(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
