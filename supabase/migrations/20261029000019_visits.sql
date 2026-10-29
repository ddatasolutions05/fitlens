-- Who opened the link, from where, via which tagged link. Written only by the
-- track-visit function (service role); read only through admin_overview().
-- Location is coarse (country, region, city) and the IP itself is never stored.
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_id uuid not null,
  user_id uuid references auth.users (id) on delete set null,
  path text check (path is null or char_length(path) <= 200),
  referrer text check (referrer is null or char_length(referrer) <= 300),
  source text check (source is null or char_length(source) <= 60),
  campaign text check (campaign is null or char_length(campaign) <= 60),
  platform text check (platform is null or char_length(platform) <= 20),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  country text check (country is null or char_length(country) <= 60),
  region text check (region is null or char_length(region) <= 60),
  city text check (city is null or char_length(city) <= 60)
);
comment on table public.visits is 'Page opens with coarse location and the invite tag. Purge after 90 days.';
alter table public.visits enable row level security;
create index visits_recent on public.visits (created_at desc);
create index visits_visitor on public.visits (visitor_id, created_at desc);

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
  v_misses jsonb;
  v_visits jsonb;
  v_sources jsonb;
  v_places jsonb;
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
      (select v.source from public.visits v where v.user_id = u.id and v.source is not null order by v.created_at asc limit 1) as first_source,
      (select coalesce(v.city || ', ', '') || coalesce(v.country, '') from public.visits v where v.user_id = u.id and v.country is not null order by v.created_at desc limit 1) as last_place,
      (select r.enabled from public.reminders r where r.user_id = u.id) as reminder_on,
      greatest(
        (select max(m.created_at) from public.meals m where m.user_id = u.id),
        (select max(w.created_at) from public.weight_logs w where w.user_id = u.id),
        (select max(a.created_at) from public.activity_records a where a.user_id = u.id),
        (select max(e.created_at) from public.client_events e where e.user_id = u.id),
        (select max(v.created_at) from public.visits v where v.user_id = u.id)
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

  select coalesce(jsonb_agg(to_jsonb(s) order by s.count desc, s.query asc), '[]'::jsonb) into v_misses
  from (
    select sm.query, count(*) as count, count(distinct sm.user_id) as people, max(sm.created_at) as last_at
    from public.search_misses sm
    where sm.created_at >= v_since
    group by sm.query
    order by count(*) desc, sm.query asc
    limit 50
  ) s;

  select coalesce(jsonb_agg(to_jsonb(v) order by v.created_at desc), '[]'::jsonb) into v_visits
  from (
    select vi.id, vi.created_at, vi.visitor_id, vi.source, vi.campaign, vi.referrer, vi.path, vi.platform, vi.country, vi.region, vi.city,
      vi.user_agent, u.email, p.display_name
    from public.visits vi
    left join auth.users u on u.id = vi.user_id
    left join public.profiles p on p.user_id = vi.user_id
    where vi.created_at >= v_since
    order by vi.created_at desc
    limit 150
  ) v;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.visits desc), '[]'::jsonb) into v_sources
  from (
    select coalesce(vi.source, '(no tag)') as source, count(*) as visits, count(distinct vi.visitor_id) as visitors,
      count(distinct vi.user_id) as signed_in, max(vi.created_at) as last_at
    from public.visits vi
    where vi.created_at >= v_since
    group by coalesce(vi.source, '(no tag)')
  ) s;

  select coalesce(jsonb_agg(to_jsonb(pl) order by pl.visitors desc), '[]'::jsonb) into v_places
  from (
    select coalesce(vi.city, '?') as city, coalesce(vi.region, '') as region, coalesce(vi.country, '?') as country,
      count(*) as visits, count(distinct vi.visitor_id) as visitors
    from public.visits vi
    where vi.created_at >= v_since
    group by 1, 2, 3
    limit 50
  ) pl;

  select jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'onboarded', (select count(*) from public.profiles where onboarding_completed_at is not null),
    'logged_a_meal', (select count(distinct user_id) from public.meals where status = 'confirmed'),
    'signed_in_recent', (select count(*) from auth.users where last_sign_in_at >= v_since),
    'meals_recent', (select count(*) from public.meals where status = 'confirmed' and created_at >= v_since),
    'errors_recent', (select count(*) from public.client_events where kind = 'error' and created_at >= v_since),
    'coach_calls_recent', (select coalesce(sum(coach_calls), 0) from public.ai_usage where local_date >= (v_since at time zone 'UTC')::date),
    'analyses_recent', (select coalesce(sum(analyses), 0) from public.ai_usage where local_date >= (v_since at time zone 'UTC')::date),
    'search_misses_recent', (select count(*) from public.search_misses where created_at >= v_since),
    'visits_recent', (select count(*) from public.visits where created_at >= v_since),
    'visitors_recent', (select count(distinct visitor_id) from public.visits where created_at >= v_since),
    'reminders_on', (select count(*) from public.reminders where enabled)
  ) into v_totals;

  return jsonb_build_object('days', v_days, 'generated_at', now(), 'totals', v_totals, 'users', v_users, 'errors', v_errors, 'events', v_events, 'misses', v_misses, 'visits', v_visits, 'sources', v_sources, 'places', v_places);
end;
$$;
grant execute on function public.admin_overview(integer) to authenticated;
