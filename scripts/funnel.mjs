// The sign-up funnel and feature use, from auth.users, profiles, meals and the
// named events the app records. Usage: node scripts/funnel.mjs [--days 7]
import 'dotenv/config';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) {
  console.error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required');
  process.exit(1);
}
const args = process.argv.slice(2);
const days = Number(args[args.indexOf('--days') + 1] || 7) || 7;

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const since = `now() - interval '${days} days'`;
const notTest = `u.email not like 'e2e-%'`;

const [funnel] = await sql(`
  select
    count(*) filter (where u.created_at > ${since})::int as signed_up,
    count(*) filter (where u.created_at > ${since} and p.onboarding_completed_at is not null)::int as onboarded,
    count(*) filter (where u.created_at > ${since} and exists (select 1 from public.meals m where m.user_id = u.id and m.status = 'confirmed'))::int as first_meal,
    count(*) filter (where u.last_sign_in_at > now() - interval '1 day')::int as active_today,
    count(*)::int as total_accounts
  from auth.users u left join public.profiles p on p.user_id = u.id
  where ${notTest}`);

const steps = await sql(`
  select e.scope, count(distinct e.user_id)::int as users, count(*)::int as times
  from public.client_events e join auth.users u on u.id = e.user_id
  where e.kind = 'event' and e.created_at > ${since} and ${notTest}
  group by e.scope order by users desc, e.scope`);

const logging = await sql(`
  select count(distinct u.id)::int as users_logging,
    round(avg(d.days), 1) as avg_days_with_a_log
  from auth.users u
  join (
    select user_id, count(distinct local_date) as days
    from (
      select user_id, local_date from public.meals where status = 'confirmed' and local_date > current_date - ${days}
      union select user_id, local_date from public.weight_logs where local_date > current_date - ${days}
      union select user_id, local_date from public.activity_records where local_date > current_date - ${days}
      union select user_id, local_date from public.water_logs where local_date > current_date - ${days}
    ) x group by user_id
  ) d on d.user_id = u.id
  where ${notTest}`);

const scans = await sql(`
  select count(*)::int as analyses,
    count(*) filter (where status = 'succeeded')::int as succeeded,
    count(distinct user_id)::int as users
  from public.photo_analyses where created_at > ${since}`);

console.log(`Last ${days} days (test account excluded)`);
console.log(`  Signed up: ${funnel.signed_up}   Finished onboarding: ${funnel.onboarded}   Logged a first meal: ${funnel.first_meal}`);
console.log(`  Active in the last day: ${funnel.active_today} of ${funnel.total_accounts} accounts`);
console.log(`  People with any log: ${logging[0]?.users_logging ?? 0}, averaging ${logging[0]?.avg_days_with_a_log ?? 0} days with a log`);
console.log(`  Photo analyses: ${scans[0]?.analyses ?? 0} (${scans[0]?.succeeded ?? 0} succeeded) by ${scans[0]?.users ?? 0} people`);
console.log('Events (people, times):');
if (steps.length === 0) console.log('  none recorded yet');
for (const s of steps) console.log(`  ${s.scope}: ${s.users}, ${s.times}`);
