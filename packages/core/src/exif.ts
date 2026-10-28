// Reads the capture time out of a JPEG's EXIF block. Nothing else is read:
// the GPS and camera tags are skipped and the bytes are never kept.
import { localDateTimeToIso } from './dates';

const SOI = 0xffd8;
const APP1 = 0xffe1;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;

function u16(b: Uint8Array, at: number, little: boolean): number {
  if (at + 2 > b.length) return -1;
  return little ? b[at]! | (b[at + 1]! << 8) : (b[at]! << 8) | b[at + 1]!;
}

function u32(b: Uint8Array, at: number, little: boolean): number {
  if (at + 4 > b.length) return -1;
  return little ? (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0 : ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
}

function ascii(b: Uint8Array, at: number, len: number): string | null {
  if (at < 0 || at + len > b.length) return null;
  let s = '';
  for (let i = at; i < at + len; i += 1) {
    const c = b[i]!;
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

interface Entry {
  tag: number;
  type: number;
  count: number;
  valueOffset: number;
}

function readIfd(b: Uint8Array, tiff: number, ifdOffset: number, little: boolean): Entry[] {
  const at = tiff + ifdOffset;
  const n = u16(b, at, little);
  if (n < 0 || n > 512) return [];
  const out: Entry[] = [];
  for (let i = 0; i < n; i += 1) {
    const e = at + 2 + i * 12;
    if (e + 12 > b.length) break;
    out.push({ tag: u16(b, e, little), type: u16(b, e + 2, little), count: u32(b, e + 4, little), valueOffset: e + 8 });
  }
  return out;
}

function asciiValue(b: Uint8Array, tiff: number, e: Entry, little: boolean): string | null {
  if (e.type !== 2) return null;
  const at = e.count <= 4 ? e.valueOffset : tiff + u32(b, e.valueOffset, little);
  return ascii(b, at, Math.min(e.count, 64));
}

/** Returns the EXIF DateTimeOriginal (falling back to DateTime) as "YYYY:MM:DD HH:MM:SS", or null. */
export function exifDateTimeOriginal(bytes: Uint8Array): string | null {
  if (u16(bytes, 0, false) !== SOI) return null;
  let at = 2;
  while (at + 4 <= bytes.length) {
    const marker = u16(bytes, at, false);
    if ((marker & 0xff00) !== 0xff00) return null;
    const size = u16(bytes, at + 2, false);
    if (size < 2) return null;
    if (marker === APP1 && ascii(bytes, at + 4, 4) === 'Exif') {
      const tiff = at + 10;
      const order = ascii(bytes, tiff, 2);
      if (order !== 'II' && order !== 'MM') return null;
      const little = order === 'II';
      if (u16(bytes, tiff + 2, little) !== 0x2a) return null;
      const ifd0 = readIfd(bytes, tiff, u32(bytes, tiff + 4, little), little);
      let fallback: string | null = null;
      for (const e of ifd0) {
        if (e.tag === TAG_DATETIME) fallback = asciiValue(bytes, tiff, e, little);
        if (e.tag === TAG_EXIF_IFD && e.type === 4) {
          for (const x of readIfd(bytes, tiff, u32(bytes, e.valueOffset, little), little)) {
            if (x.tag === TAG_DATETIME_ORIGINAL) {
              const v = asciiValue(bytes, tiff, x, little);
              if (v && isExifDate(v)) return v;
            }
          }
        }
      }
      return fallback && isExifDate(fallback) ? fallback : null;
    }
    if (marker === 0xffda) return null;
    at += 2 + size;
  }
  return null;
}

export function isExifDate(v: string): boolean {
  return /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(v) && !v.startsWith('0000');
}

/** EXIF dates carry no zone; they are read as local time in the given zone. */
export function exifDateToIso(exifDate: string, tz: string): string | null {
  if (!isExifDate(exifDate)) return null;
  const [d, t] = exifDate.split(' ') as [string, string];
  const localDate = d.replace(/:/g, '-');
  const hhmm = t.slice(0, 5);
  if (Number.isNaN(Date.parse(localDate))) return null;
  try {
    return localDateTimeToIso(localDate, hhmm, tz);
  } catch {
    return null;
  }
}
