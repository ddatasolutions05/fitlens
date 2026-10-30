// Prints what users hit: client error reports (client_events) and edge function
// failures, both read through the Management API. No database password needed.
// The logs endpoint takes ClickHouse SQL over one `logs` table and at most a
// 24 hour window, so --hours is capped at 24.
// Usage: node scripts/telemetry.mjs [--hours 24] [--purge] [--json]
import 'dotenv/config';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');
  process.exit(1);
}

const args = process.argv.slice(2);
const requestedHours = Number(args[args.indexOf('--hours') + 1] || 24) || 24;
const hours = Math.min(24, Math.max(1, requestedHours));
const purge = args.includes('--purge');
const asJson = args.includes('--json');
const base = `https://api.supabase.com/v1/projects/${ref}`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function sql(query) {
  const res = await fetch(`${base}/database/query`, { method: 'POST', headers, body: JSON.stringify({ query }) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

async function logs(query) {
  const url = new URL(`${base}/analytics/endpoints/logs`);
  url.searchParams.set('sql', query);
  url.searchParams.set('iso_timestamp_start', new Date(Date.now() - hours * 3600_000).toISOString());
  url.searchParams.set('iso_timestamp_end', new Date().toISOString());
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const body = await res.json();
  if (body.error) throw new Error(String(body.error));
  return body.result ?? [];
}

// The endpoint throttles bursts; space the log queries out.
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clientErrors = await sql(`
  select scope, message, platform, app_version, count(*)::int as n, max(created_at) as last_seen, count(distinct user_id)::int as users
  from public.client_events
  where kind = 'error' and created_at > now() - interval '${requestedHours} hours'
  group by scope, message, platform, app_version
  order by last_seen desc
  limit 100`);

// A failed log query is reported as unavailable, never counted as an error.
async function safely(fn) {
  try {
    return await fn();
  } catch (err) {
    const rows = [];
    rows.unavailable = `logs endpoint: ${err instanceof Error ? err.message : err}`.slice(0, 200);
    return rows;
  }
}

const count = (rows) => (rows.unavailable ? `unavailable (${rows.unavailable})` : String(rows.length));

const functionErrors = await safely(() =>
  logs(`
    select timestamp, event_message,
      log_attributes['response.status_code'] as status,
      log_attributes['request.method'] as method,
      log_attributes['request.pathname'] as path,
      log_attributes['execution_time_ms'] as ms
    from logs
    where source = 'function_edge_logs' and toInt32OrZero(log_attributes['response.status_code']) >= 400
    order by timestamp desc
    limit 100`),
);
await pause(3000);
const functionConsole = await safely(() =>
  logs(`
    select timestamp, event_message, log_attributes['level'] as level, log_attributes['function_id'] as function_id
    from logs
    where source = 'function_logs' and log_attributes['level'] in ('error', 'warn', 'warning')
    order by timestamp desc
    limit 100`),
);
await pause(3000);
const authErrors = await safely(() =>
  logs(`
    select timestamp, event_message, log_attributes['level'] as level, log_attributes['path'] as path
    from logs
    where source = 'auth_logs' and log_attributes['level'] in ('error', 'fatal')
    order by timestamp desc
    limit 50`),
);

let purged = null;
if (purge) {
  const rows = await sql('select fitlens.purge_client_events(30) as n');
  purged = rows[0]?.n ?? 0;
}

if (asJson) {
  console.log(JSON.stringify({ hours: requestedHours, logHours: hours, clientErrors, functionErrors, functionConsole, authErrors, purged }, null, 2));
  process.exit(0);
}

const ts = (v) => String(v ?? '').replace('T', ' ').slice(0, 19);

console.log(`Client error reports, last ${requestedHours} h: ${clientErrors.length} distinct`);
for (const r of clientErrors) {
  console.log(`  ${r.n}x [${r.scope}] ${r.message} (${r.platform ?? '?'} ${r.app_version ?? '?'}, ${r.users} user${r.users === 1 ? '' : 's'}, last ${ts(r.last_seen)})`);
}
console.log(`Edge function responses >= 400, last ${hours} h: ${count(functionErrors)}`);
for (const r of functionErrors) {
  console.log(`  ${ts(r.timestamp)} ${r.status ?? ''} ${r.method ?? ''} ${r.path ?? ''} ${r.ms ? `${r.ms} ms` : ''} ${r.status ? '' : (r.event_message ?? '')}`.replace(/\s+/g, ' ').trim());
}
console.log(`Edge function console errors and warnings, last ${hours} h: ${count(functionConsole)}`);
for (const r of functionConsole) {
  console.log(`  ${ts(r.timestamp)} ${r.level ?? ''} ${(r.event_message ?? '').slice(0, 300)}`.trim());
}
console.log(`Auth errors, last ${hours} h: ${count(authErrors)}`);
for (const r of authErrors) {
  console.log(`  ${ts(r.timestamp)} ${r.level ?? ''} ${r.path ?? ''} ${(r.event_message ?? '').slice(0, 300)}`.replace(/\s+/g, ' ').trim());
}
if (purged !== null) console.log(`Purged ${purged} report(s) older than 30 days`);
