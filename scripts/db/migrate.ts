// Applies supabase/migrations/*.sql in order to DATABASE_URL.
// Flags: --shim (apply supabase/test/shim_auth.sql first, plain Postgres only)
//        --reset (drop and recreate the database named in DATABASE_URL)
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';

const root = resolve(import.meta.dirname, '..', '..');
const migrationsDir = join(root, 'supabase', 'migrations');
const shimPath = join(root, 'supabase', 'test', 'shim_auth.sql');

export interface MigrateOptions {
  databaseUrl: string;
  shim?: boolean;
  reset?: boolean;
  log?: (line: string) => void;
}

export async function migrate(opts: MigrateOptions): Promise<string[]> {
  const log = opts.log ?? (() => {});
  const url = new URL(opts.databaseUrl);
  const dbName = url.pathname.replace(/^\//, '');

  if (opts.reset) {
    const admin = new Client({ connectionString: withDatabase(url, 'postgres') });
    await admin.connect();
    await admin.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
      [dbName],
    );
    await admin.query(`drop database if exists "${dbName}"`);
    await admin.query(`create database "${dbName}"`);
    await admin.end();
    log(`recreated database ${dbName}`);
  }

  const client = new Client({ connectionString: opts.databaseUrl });
  await client.connect();
  try {
    if (opts.shim) {
      await client.query(readFileSync(shimPath, 'utf8'));
      await client.query(`alter database "${dbName}" set search_path to "$user", public, extensions`);
      log('applied auth/storage shim');
    }
    await client.query('create schema if not exists supabase_migrations');
    await client.query(
      `create table if not exists supabase_migrations.schema_migrations (
         version text primary key, name text, statements text[], applied_at timestamptz default now())`,
    );
    const applied = new Set(
      (await client.query<{ version: string }>('select version from supabase_migrations.schema_migrations')).rows.map(
        (r) => r.version,
      ),
    );
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const ran: string[] = [];
    for (const file of files) {
      const version = file.split('_')[0] ?? file;
      if (applied.has(version)) continue;
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      await client.query('begin');
      try {
        // Reset the search path per migration so the shim's database-level setting applies.
        await client.query(`set local search_path to "$user", public, extensions`);
        await client.query(sql);
        await client.query(
          'insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)',
          [version, file, [sql]],
        );
        await client.query('commit');
        ran.push(file);
        log(`applied ${file}`);
      } catch (err) {
        await client.query('rollback');
        throw new Error(`migration ${file} failed: ${(err as Error).message}`);
      }
    }
    return ran;
  } finally {
    await client.end();
  }
}

function withDatabase(url: URL, db: string): string {
  const copy = new URL(url.toString());
  copy.pathname = `/${db}`;
  return copy.toString();
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isMain) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  migrate({
    databaseUrl,
    shim: process.argv.includes('--shim'),
    reset: process.argv.includes('--reset'),
    log: console.log,
  })
    .then((ran) => console.log(ran.length ? `${ran.length} migration(s) applied` : 'up to date'))
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
