import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Client, Pool, type PoolClient } from 'pg';
import { migrate } from '../../scripts/db/migrate';

export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres@localhost:54329/fitlens_test';

let pool: Pool | undefined;

export async function resetDatabase(): Promise<void> {
  await migrate({ databaseUrl: DATABASE_URL, reset: true, shim: true });
  pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export interface TestUser {
  id: string;
  email: string;
}

export async function createUser(label: string): Promise<TestUser> {
  const id = randomUUID();
  const email = `${label}-${id.slice(0, 8)}@example.test`;
  await admin((c) => c.query('insert into auth.users (id, email) values ($1, $2)', [id, email]));
  return { id, email };
}

function getPool(): Pool {
  if (!pool) throw new Error('resetDatabase() has not been called');
  return pool;
}

/** Runs fn with superuser rights (what the service role or a migration sees). */
export async function admin<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await getPool().connect();
  try {
    return await fn(c);
  } finally {
    c.release();
  }
}

/**
 * Runs fn as the `authenticated` role with the given user's JWT claims, the way
 * PostgREST does for a signed-in user. Each call is its own transaction.
 */
export async function as<T>(user: TestUser, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await getPool().connect();
  try {
    await c.query('begin');
    await c.query('set local role authenticated');
    await c.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: user.id, role: 'authenticated', email: user.email }),
    ]);
    const result = await fn(c);
    await c.query('commit');
    return result;
  } catch (err) {
    await c.query('rollback').catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

export async function withClient<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export function uuid(): string {
  return randomUUID();
}

export async function expectDenied(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    return (err as Error).message;
  }
  throw new Error('expected the statement to be rejected');
}
