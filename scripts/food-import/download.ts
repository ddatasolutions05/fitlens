import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { rawDir } from './types';

// Returns the local path of `fileName` inside raw/<dirName>, downloading it first if missing.
export async function ensureDownloaded(url: string, dirName: string, fileName: string): Promise<string> {
  const dir = join(rawDir, dirName);
  const target = join(dir, fileName);
  if (existsSync(target)) return target;
  mkdirSync(dir, { recursive: true });
  console.log(`downloading ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status} ${res.statusText}: ${url}`);
  const part = `${target}.part`;
  try {
    await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(part));
    renameSync(part, target);
  } catch (err) {
    rmSync(part, { force: true });
    throw err;
  }
  return target;
}
