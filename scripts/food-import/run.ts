// Imports shared foods into DATABASE_URL.
// Usage: tsx scripts/food-import/run.ts --source usda|cnf|indian|all [--limit N] [--dry-run]
import 'dotenv/config';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { writeFoods } from './db';
import { loadCnf } from './sources/cnf';
import { loadIndian } from './sources/indian';
import { loadUsda } from './sources/usda';
import type { FoodRow } from './types';

const LOADERS: Record<string, () => Promise<FoodRow[]>> = {
  usda: loadUsda,
  cnf: loadCnf,
  indian: loadIndian,
};

interface Args {
  sources: string[];
  limit: number | null;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  let source: string | undefined;
  let limit: number | null = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') source = argv[++i];
    else if (a?.startsWith('--source=')) source = a.slice('--source='.length);
    else if (a === '--limit') limit = Number(argv[++i]);
    else if (a?.startsWith('--limit=')) limit = Number(a.slice('--limit='.length));
    else if (a === '--dry-run') dryRun = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!source || !(source === 'all' || source in LOADERS)) {
    throw new Error('usage: run.ts --source usda|cnf|indian|all [--limit N] [--dry-run]');
  }
  if (limit !== null && !(Number.isInteger(limit) && limit > 0)) throw new Error('--limit must be a positive integer');
  return { sources: source === 'all' ? Object.keys(LOADERS) : [source], limit, dryRun };
}

// Keeps the last row per source_ref, so one statement never touches the same row twice.
function dedupe(rows: FoodRow[]): FoodRow[] {
  const map = new Map<string, FoodRow>();
  for (const r of rows) map.set(r.sourceRef, r);
  return [...map.values()];
}

// With --limit, keep bases of any selected variant so variant_of still resolves.
function applyLimit(rows: FoodRow[], limit: number | null): FoodRow[] {
  if (limit === null) return rows;
  const picked = rows.slice(0, limit);
  const refs = new Set(picked.map((r) => r.sourceRef));
  const missing = rows.filter((r) => !refs.has(r.sourceRef) && picked.some((p) => p.variantOfRef === r.sourceRef));
  return [...missing, ...picked];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!args.dryRun && !url) throw new Error('DATABASE_URL is not set (env or .env)');

  const client = args.dryRun ? null : new Client({ connectionString: url });
  await client?.connect();
  try {
    for (const name of args.sources) {
      const started = Date.now();
      const loader = LOADERS[name];
      if (!loader) continue;
      const rows = applyLimit(dedupe(await loader()), args.limit);
      const servings = rows.reduce((n, r) => n + r.servings.length, 0);
      if (!client) {
        console.log(`${name}: parsed ${rows.length}, servings ${servings} (dry run, nothing written)`);
        continue;
      }
      await client.query('begin');
      try {
        const c = await writeFoods(client, rows);
        await client.query('commit');
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        console.log(`${name}: parsed ${rows.length}, inserted ${c.inserted}, updated ${c.updated}, servings ${c.servings} (${secs}s)`);
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
  } finally {
    await client?.end();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isMain) {
  main().catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
}
