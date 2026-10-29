// One-time setup of the reminder schedule on the linked project: pg_cron and
// pg_net, the shared secret in Vault, and a job every 10 minutes that calls
// the send-reminders function with that secret.
// Usage: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... REMINDER_CRON_SECRET=... node scripts/db/setup-reminder-cron.mjs
import 'dotenv/config';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const secret = process.env.REMINDER_CRON_SECRET;
if (!token || !ref || !secret) throw new Error('SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF and REMINDER_CRON_SECRET are required');
if (!/^[A-Za-z0-9_-]{16,}$/.test(secret)) throw new Error('REMINDER_CRON_SECRET must be base64url, 16+ characters');

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`query failed: ${res.status} ${body.message ?? JSON.stringify(body)}`);
  return body;
}

await query('create extension if not exists pg_cron; create extension if not exists pg_net;');
const existing = await query(`select id from vault.secrets where name = 'reminder_cron_secret'`);
if (existing.length === 0) {
  await query(`select vault.create_secret('${secret}', 'reminder_cron_secret', 'Header the reminder schedule sends to send-reminders')`);
  console.log('vault secret created');
} else {
  await query(`select vault.update_secret('${existing[0].id}', '${secret}')`);
  console.log('vault secret updated');
}
const jobs = await query(`select jobid from cron.job where jobname = 'fitlens-reminders'`);
for (const j of jobs) await query(`select cron.unschedule(${j.jobid})`);
const url = `https://${ref}.supabase.co/functions/v1/send-reminders`;
await query(`select cron.schedule('fitlens-reminders', '*/10 * * * *', $cron$
  select net.http_post(
    url := '${url}',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminder_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
$cron$)`);
const check = await query(`select jobname, schedule, active from cron.job where jobname = 'fitlens-reminders'`);
console.log(JSON.stringify(check));
