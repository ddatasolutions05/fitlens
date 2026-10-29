-- Search by the names people actually type (chawal, sabji, anda) and record
-- searches that found nothing so the food list grows where it is thin.
alter table public.foods add column aliases text;
comment on column public.foods.aliases is 'Comma separated other names, matched by search_foods alongside name.';

drop function public.search_foods(text, integer);
create or replace function public.search_foods(p_query text, p_limit integer default 25)
returns table (
  id uuid,
  name text,
  brand text,
  source text,
  verified boolean,
  owner_user_id uuid,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fibre_g numeric,
  sodium_mg numeric,
  sat_fat_g numeric,
  default_serving_g numeric,
  variant_label text,
  attribution text,
  favourite boolean,
  use_count integer,
  usual_grams numeric,
  rank_bucket integer,
  similarity real
)
language sql
stable
as $$
  with q as (select extensions.unaccent(trim(p_query)) as text)
  select
    f.id, f.name, f.brand, f.source, f.verified, f.owner_user_id,
    f.kcal, f.protein_g, f.carbs_g, f.fat_g, f.fibre_g, f.sodium_mg, f.sat_fat_g,
    f.default_serving_g, f.variant_label, f.attribution,
    coalesce(u.favourite, false) as favourite,
    coalesce(u.use_count, 0) as use_count,
    u.usual_grams,
    case
      when u.user_id is not null then 0
      when f.verified then 1
      else 2
    end as rank_bucket,
    greatest(
      extensions.similarity(extensions.unaccent(f.name), (select text from q)),
      coalesce(extensions.similarity(extensions.unaccent(f.aliases), (select text from q)), 0)
    ) as similarity
  from public.foods f
  left join public.user_food_usage u on u.food_id = f.id and u.user_id = auth.uid()
  where (f.owner_user_id is null or f.owner_user_id = auth.uid())
    and (f.source <> 'ai_estimate' or u.user_id is not null)
    and (
      extensions.unaccent(f.name) ilike '%' || (select text from q) || '%'
      or (f.aliases is not null and extensions.unaccent(f.aliases) ilike '%' || (select text from q) || '%')
      or f.search_tsv @@ websearch_to_tsquery('simple', (select text from q))
      or extensions.similarity(extensions.unaccent(f.name), (select text from q)) > 0.3
      or (f.aliases is not null and extensions.similarity(extensions.unaccent(f.aliases), (select text from q)) > 0.3)
    )
  order by rank_bucket asc,
    coalesce(u.favourite, false) desc,
    u.last_used_at desc nulls last,
    similarity desc,
    length(f.name) asc
  limit greatest(1, least(p_limit, 100))
$$;
grant execute on function public.search_foods(text, integer) to authenticated;

create table public.search_misses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  query text not null check (char_length(query) between 2 and 80),
  created_at timestamptz not null default now()
);
comment on table public.search_misses is 'Food searches that returned nothing. Read on the admin screen; no personal data beyond the words typed.';
alter table public.search_misses enable row level security;
-- No policies: written through note_search_miss(), read through admin_overview().
create index search_misses_recent on public.search_misses (created_at desc);

create or replace function public.note_search_miss(p_query text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.search_misses (user_id, query)
  select auth.uid(), lower(left(trim(p_query), 80))
  where auth.uid() is not null and char_length(trim(p_query)) between 2 and 80;
$$;
grant execute on function public.note_search_miss(text) to authenticated;

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

  select coalesce(jsonb_agg(to_jsonb(s) order by s.count desc, s.query asc), '[]'::jsonb) into v_misses
  from (
    select sm.query, count(*) as count, count(distinct sm.user_id) as people, max(sm.created_at) as last_at
    from public.search_misses sm
    where sm.created_at >= v_since
    group by sm.query
    order by count(*) desc, sm.query asc
    limit 50
  ) s;

  select jsonb_build_object(
    'accounts', (select count(*) from auth.users),
    'onboarded', (select count(*) from public.profiles where onboarding_completed_at is not null),
    'logged_a_meal', (select count(distinct user_id) from public.meals where status = 'confirmed'),
    'signed_in_recent', (select count(*) from auth.users where last_sign_in_at >= v_since),
    'meals_recent', (select count(*) from public.meals where status = 'confirmed' and created_at >= v_since),
    'errors_recent', (select count(*) from public.client_events where kind = 'error' and created_at >= v_since),
    'coach_calls_recent', (select coalesce(sum(coach_calls), 0) from public.ai_usage where local_date >= (v_since at time zone 'UTC')::date),
    'analyses_recent', (select coalesce(sum(analyses), 0) from public.ai_usage where local_date >= (v_since at time zone 'UTC')::date),
    'search_misses_recent', (select count(*) from public.search_misses where created_at >= v_since)
  ) into v_totals;

  return jsonb_build_object('days', v_days, 'generated_at', now(), 'totals', v_totals, 'users', v_users, 'errors', v_errors, 'events', v_events, 'misses', v_misses);
end;
$$;
grant execute on function public.admin_overview(integer) to authenticated;
