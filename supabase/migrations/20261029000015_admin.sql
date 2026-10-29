-- Owner's admin overview. Admins are rows in app_admins (added by hand, never
-- from the client); the overview is a security definer function that checks it.
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.app_admins is 'Who may call admin_overview(). Insert rows with the service role or SQL editor only.';
alter table public.app_admins enable row level security;
-- No policies: nothing reads this table except the functions below.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_overview(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 7), 90));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)));
  v_users jsonb;
  v_errors jsonb;
  v_events jsonb;
  v_totals jsonb;
begin
  if not public.is_admin() then
    raise insufficient_privilege using message = 'admin only';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.signed_up_at desc), '[]'::jsonb) into v_users
  from (
    select u.id as user_id,
      u.email,
      u.phone,
      coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
      u.created_at as signed_up_at,
      u.last_sign_in_at,
      p.display_name,
      p.onboarding_completed_at,
      (select count(*) from public.meals m where m.user_id = u.id and m.status = 'confirmed') as meals,
      (select count(*) from public.meals m where m.user_id = u.id and m.status = 'confirmed' and m.created_at >= v_since) as meals_recent,
      (select count(*) from public.meal_photos mp where mp.user_id = u.id) as photos,
      (select count(*) from public.weight_logs w where w.user_id = u.id) as weights,
      (select count(*) from public.activity_records a where a.user_id = u.id) as activity,
      (select count(*) from public.water_logs wl where wl.user_id = u.id) as water,
      (select coalesce(sum(ai.coach_calls), 0) from public.ai_usage ai where ai.user_id = u.id) as coach_calls,
      (select coalesce(sum(ai.analyses), 0) from public.ai_usage ai where ai.user_id = u.id) as analyses,
      (select count(*) from public.client_events e where e.user_id = u.id and e.kind = 'error' and e.created_at >= v_since) as errors_recent,
      greatest(
        (select max(m.created_at) from public.meals m where m.user_id = u.id),
        (select max(w.created_at) from public.weight_logs w where w.user_id = u.id),
        (select max(a.created_at) from public.activity_records a where a.user_id = u.id),
        (select max(e.created_at) from public.client_events e where e.user_id = u.id)
      ) as last_active_at
    from auth.users u
    left join public.profiles p on p.user_id = u.id
  ) x;

  select coalesce(jsonb_agg(to_jsonb(y) order by y.created_at desc), '[]'::jsonb) into v_errors
  from (
    select e.id, e.created_at, e.scope, e.message, e.platform, e.route, e.app_version, u.email
    from public.client_events e
    left join auth.users u on u.id = e.user_id
    where e.kind = 'error' and e.created_at >= v_since
    order by e.created_at desc
    limit 100
  ) y;

  select coalesce(jsonb_agg(to_jsonb(z) order by z.count desc), '[]'::jsonb) into v_events
  from (
    select e.scope as name, count(*) as count, count(distinct e.user_id) as people
    from public.client_events e
    where e.kind = 'event' and e.created_at >= v_since
    group by e.scope
  ) z;

  select jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'onboarded', (select count(*) from public.profiles where onboarding_completed_at is not null),
    'logged_a_meal', (select count(distinct user_id) from public.meals where status = 'confirmed'),
    'signed_in_recent', (select count(*) from auth.users where last_sign_in_at >= v_since),
    'meals_recent', (select count(*) from public.meals where status = 'confirmed' and created_at >= v_since),
    'errors_recent', (select count(*) from public.client_events where kind = 'error' and created_at >= v_since),
    'coach_calls_recent', (select coalesce(sum(coach_calls), 0) from public.ai_usage where local_date >= (v_since at time zone 'UTC')::date),
    'analyses_recent', (select coalesce(sum(analyses), 0) from public.ai_usage where local_date >= (v_since at time zone 'UTC')::date)
  ) into v_totals;

  return jsonb_build_object('days', v_days, 'generated_at', now(), 'totals', v_totals, 'users', v_users, 'errors', v_errors, 'events', v_events);
end;
$$;
grant execute on function public.admin_overview(integer) to authenticated;
