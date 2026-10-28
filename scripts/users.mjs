// Who signed up and what they have logged, read through the Management API.
// Usage: node scripts/users.mjs  (needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF)
import 'dotenv/config';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const q = async (sql) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  return r.json();
};

const users = await q(`
select u.email, u.phone, u.raw_app_meta_data->>'provider' as provider,
  to_char(u.created_at at time zone 'America/Toronto','YYYY-MM-DD HH24:MI') as signed_up,
  to_char(u.email_confirmed_at at time zone 'America/Toronto','YYYY-MM-DD HH24:MI') as confirmed,
  to_char(u.last_sign_in_at at time zone 'America/Toronto','YYYY-MM-DD HH24:MI') as last_sign_in,
  (p.onboarding_completed_at is not null) as onboarded, p.display_name,
  (select count(*) from public.meals m where m.user_id=u.id) as meals,
  (select count(*) from public.meal_photos mp where mp.user_id=u.id) as photos,
  (select count(*) from public.photo_analyses pa where pa.user_id=u.id) as analyses,
  (select count(*) from public.weight_logs w where w.user_id=u.id) as weights,
  (select count(*) from public.activity_records a where a.user_id=u.id) as activity,
  (select count(*) from public.water_logs wl where wl.user_id=u.id) as water,
  (select coalesce(sum(coach_calls),0) from public.ai_usage ai where ai.user_id=u.id) as coach_calls
from auth.users u left join public.profiles p on p.user_id=u.id
order by u.created_at`);
console.log('USERS');
for (const u of users) console.log(JSON.stringify(u));

const audit = await q(`
select to_char(created_at at time zone 'America/Toronto','MM-DD HH24:MI') as at,
  payload->>'action' as action, payload->>'actor_username' as who,
  payload->'traits'->>'provider' as provider
from auth.audit_log_entries
where created_at > now() - interval '3 days' and coalesce(payload->>'actor_username','') not like 'e2e-%'
order by created_at desc limit 80`);
console.log('AUDIT');
for (const a of audit) console.log(`${a.at}  ${a.action}  ${a.who ?? ''}  ${a.provider ?? ''}`);
