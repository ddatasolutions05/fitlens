// Minimal zip reader: central directory lookup plus streamed inflate.
// Entries are never written to disk, so archive paths cannot escape anywhere.
import { readFileSync } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { createInflateRaw } from 'node:zlib';

const MAX_ENTRY_BYTES = 512 * 1024 * 1024;

interface Entry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

export class ZipArchive {
  private readonly buf: Buffer;
  readonly entries: Entry[];

  constructor(path: string) {
    this.buf = readFileSync(path);
    this.entries = readCentralDirectory(this.buf);
  }

  // Finds an entry by its base name, ignoring folders and case.
  find(baseName: string): Entry {
    const want = baseName.toLowerCase();
    const hit = this.entries.find((e) => (e.name.split('/').pop() ?? '').toLowerCase() === want);
    if (!hit) throw new Error(`zip entry not found: ${baseName}`);
    return hit;
  }

  open(baseName: string): Readable {
    const e = this.find(baseName);
    const b = this.buf;
    if (b.readUInt32LE(e.localOffset) !== 0x04034b50) throw new Error(`bad local header for ${e.name}`);
    const start = e.localOffset + 30 + b.readUInt16LE(e.localOffset + 26) + b.readUInt16LE(e.localOffset + 28);
    const data = b.subarray(start, start + e.compressedSize);
    const src = Readable.from([data]);
    if (e.method === 0) return src;
    if (e.method !== 8) throw new Error(`unsupported compression method ${e.method} for ${e.name}`);
    return src.pipe(createInflateRaw()).pipe(sizeGuard(e.name));
  }
}

function sizeGuard(name: string): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      seen += chunk.length;
      if (seen > MAX_ENTRY_BYTES) cb(new Error(`zip entry ${name} exceeds ${MAX_ENTRY_BYTES} bytes`));
      else cb(null, chunk);
    },
  });
}

function readCentralDirectory(b: Buffer): Entry[] {
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (b.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip file (no end of central directory)');
  const count = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const entries: Entry[] = [];
  for (let i = 0; i < count; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt zip central directory');
    const flags = b.readUInt16LE(p + 8);
    const nameLen = b.readUInt16LE(p + 28);
    const extraLen = b.readUInt16LE(p + 30);
    const commentLen = b.readUInt16LE(p + 32);
    const name = b.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nameLen);
    const entry: Entry = {
      name,
      method: b.readUInt16LE(p + 10),
      compressedSize: b.readUInt32LE(p + 20),
      size: b.readUInt32LE(p + 24),
      localOffset: b.readUInt32LE(p + 42),
    };
    if (flags & 0x1) throw new Error(`encrypted zip entry: ${name}`);
    if (entry.size > MAX_ENTRY_BYTES || entry.compressedSize === 0xffffffff) {
      throw new Error(`zip entry too large or zip64: ${name}`);
    }
    entries.push(entry);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
