// Applies supabase/migrations/*.sql to the linked project through the
// Management API, so no database password is needed. Tracks versions in
// supabase_migrations.schema_migrations, the same table `supabase db push` uses.
// Usage: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... npx tsx scripts/db/push-remote.ts
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');
  process.exit(1);
}

const migrationsDir = resolve(import.meta.dirname, '..', '..', 'supabase', 'migrations');

async function query<T = unknown>(sql: string): Promise<T> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function main(): Promise<void> {
  await query('create schema if not exists supabase_migrations');
  await query(
    'create table if not exists supabase_migrations.schema_migrations (version text primary key, name text, statements text[], applied_at timestamptz default now())',
  );
  const applied = new Set((await query<{ version: string }[]>('select version from supabase_migrations.schema_migrations')).map((r) => r.version));
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  let ran = 0;
  for (const file of files) {
    const version = file.split('_')[0] ?? file;
    if (applied.has(version)) continue;
    await query(readFileSync(join(migrationsDir, file), 'utf8'));
    await query(`insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${file.replace(/'/g, "''")}')`);
    console.log(`applied ${file}`);
    ran += 1;
  }
  console.log(ran ? `${ran} migration(s) applied` : 'up to date');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
