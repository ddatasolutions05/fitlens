import { describe, expect, it } from 'vitest';

import { exifDateTimeOriginal, exifDateToIso } from './exif';

// Builds a minimal JPEG: SOI, one APP1 EXIF segment with IFD0 (DateTime, ExifIFD
// pointer) and an Exif IFD (DateTimeOriginal), then SOS.
function jpegWithExif(i: { original?: string; dateTime?: string; little: boolean }): Uint8Array {
  const little = i.little;
  const bytes: number[] = [];
  const put16 = (v: number) => (little ? bytes.push(v & 0xff, v >> 8) : bytes.push(v >> 8, v & 0xff));
  const put32 = (v: number) => (little ? bytes.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24) : bytes.push(v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff));
  const putAscii = (s: string) => bytes.push(...Array.from(s, (c) => c.charCodeAt(0)), 0);

  // TIFF header
  bytes.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]));
  put16(0x2a);
  put32(8);
  // IFD0 at 8: two entries
  const ifd0Entries = (i.dateTime ? 1 : 0) + 1;
  put16(ifd0Entries);
  const ifd0Size = 2 + ifd0Entries * 12 + 4;
  const dateTimeOffset = 8 + ifd0Size;
  const exifIfdOffset = dateTimeOffset + (i.dateTime ? 20 : 0);
  if (i.dateTime) {
    put16(0x0132);
    put16(2);
    put32(20);
    put32(dateTimeOffset);
  }
  put16(0x8769);
  put16(4);
  put32(1);
  put32(exifIfdOffset);
  put32(0);
  if (i.dateTime) putAscii(i.dateTime);
  // Exif IFD
  const exifEntries = i.original ? 1 : 0;
  put16(exifEntries);
  const originalOffset = exifIfdOffset + 2 + exifEntries * 12 + 4;
  if (i.original) {
    put16(0x9003);
    put16(2);
    put32(20);
    put32(originalOffset);
  }
  put32(0);
  if (i.original) putAscii(i.original);

  const tiff = bytes;
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const len = app1.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...app1, 0xff, 0xda, 0, 2]);
}

describe('exifDateTimeOriginal', () => {
  it('reads DateTimeOriginal from a little-endian EXIF block', () => {
    expect(exifDateTimeOriginal(jpegWithExif({ original: '2026:10:28 13:48:02', little: true }))).toBe('2026:10:28 13:48:02');
  });

  it('reads DateTimeOriginal from a big-endian EXIF block', () => {
    expect(exifDateTimeOriginal(jpegWithExif({ original: '2026:01:05 07:15:30', little: false }))).toBe('2026:01:05 07:15:30');
  });

  it('falls back to DateTime when DateTimeOriginal is missing', () => {
    expect(exifDateTimeOriginal(jpegWithExif({ dateTime: '2025:12:31 23:59:59', little: true }))).toBe('2025:12:31 23:59:59');
  });

  it('returns null for a JPEG without EXIF, a non-JPEG, or an unset date', () => {
    expect(exifDateTimeOriginal(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBeNull();
    expect(exifDateTimeOriginal(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(exifDateTimeOriginal(jpegWithExif({ original: '0000:00:00 00:00:00', little: true }))).toBeNull();
  });

  it('survives truncated input', () => {
    const full = jpegWithExif({ original: '2026:10:28 13:48:02', little: true });
    for (let n = 0; n < full.length; n += 7) expect(() => exifDateTimeOriginal(full.subarray(0, n))).not.toThrow();
  });
});

describe('exifDateToIso', () => {
  it('reads the wall clock in the given zone', () => {
    expect(exifDateToIso('2026:10:28 13:48:02', 'America/Toronto')).toBe('2026-10-28T17:48:00.000Z');
    expect(exifDateToIso('2026:07:01 09:00:00', 'Asia/Kolkata')).toBe('2026-07-01T03:30:00.000Z');
  });

  it('rejects malformed values', () => {
    expect(exifDateToIso('yesterday', 'UTC')).toBeNull();
    expect(exifDateToIso('2026:13:40 25:00:00', 'UTC')).toBeNull();
  });
});
