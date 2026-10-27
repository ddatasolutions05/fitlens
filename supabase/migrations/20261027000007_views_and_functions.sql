-- Read helpers. Views use security_invoker so RLS applies to the caller.

-- Confirmed meals only. Null nutrients are excluded from the sum and counted.
create or replace view public.daily_totals
with (security_invoker = true)
as
select
  m.user_id,
  m.local_date,
  count(distinct m.id) as meal_count,
  count(mi.id) as item_count,
  sum(mi.kcal) as kcal,
  count(mi.id) filter (where mi.kcal is null) as kcal_unknown,
  sum(mi.protein_g) as protein_g,
  count(mi.id) filter (where mi.protein_g is null) as protein_unknown,
  sum(mi.carbs_g) as carbs_g,
  count(mi.id) filter (where mi.carbs_g is null) as carbs_unknown,
  sum(mi.fat_g) as fat_g,
  count(mi.id) filter (where mi.fat_g is null) as fat_unknown,
  sum(mi.fibre_g) as fibre_g,
  count(mi.id) filter (where mi.fibre_g is null) as fibre_unknown,
  sum(mi.sodium_mg) as sodium_mg,
  count(mi.id) filter (where mi.sodium_mg is null) as sodium_unknown,
  sum(mi.sat_fat_g) as sat_fat_g,
  count(mi.id) filter (where mi.sat_fat_g is null) as sat_fat_unknown,
  sum(mi.kcal_low) as kcal_low,
  sum(mi.kcal_high) as kcal_high
from public.meals m
join public.meal_items mi on mi.meal_id = m.id
where m.status = 'confirmed'
group by m.user_id, m.local_date;
grant select on public.daily_totals to authenticated, service_role;

create or replace view public.daily_water
with (security_invoker = true)
as
select user_id, local_date, sum(ml)::integer as ml, count(*) as entries
from public.water_logs
group by user_id, local_date;
grant select on public.daily_water to authenticated, service_role;

-- One step source per day: lowest integration priority wins, manual is the fallback.
create or replace view public.daily_activity
with (security_invoker = true)
as
with step_rows as (
  select
    a.user_id, a.local_date, a.source, sum(a.steps) as steps,
    coalesce(
      (select ic.priority from public.integration_connections ic
       where ic.user_id = a.user_id and ic.provider = a.source), 100
    ) as priority
  from public.activity_records a
  where a.kind = 'steps'
  group by a.user_id, a.local_date, a.source
),
steps_pick as (
  select distinct on (user_id, local_date) user_id, local_date, steps, source
  from step_rows
  order by user_id, local_date, priority asc, steps desc
),
workouts as (
  select user_id, local_date,
    count(*) as workout_count,
    sum(duration_min) as workout_minutes,
    sum(kcal_estimate) as workout_kcal
  from public.activity_records
  where kind = 'workout'
  group by user_id, local_date
)
select
  coalesce(s.user_id, w.user_id) as user_id,
  coalesce(s.local_date, w.local_date) as local_date,
  s.steps,
  s.source as steps_source,
  w.workout_count,
  w.workout_minutes,
  w.workout_kcal
from steps_pick s
full outer join workouts w on w.user_id = s.user_id and w.local_date = s.local_date;
grant select on public.daily_activity to authenticated, service_role;

-- The goal version in force on a date.
create or replace function public.goal_for_date(p_date date)
returns setof public.goal_versions
language sql
stable
as $$
  select *
  from public.goal_versions
  where user_id = auth.uid() and effective_from <= p_date
  order by effective_from desc, created_at desc
  limit 1
$$;
grant execute on function public.goal_for_date(date) to authenticated;

-- Search: own recents and favourites, then verified sources, then community.
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
    extensions.similarity(extensions.unaccent(f.name), (select text from q)) as similarity
  from public.foods f
  left join public.user_food_usage u on u.food_id = f.id and u.user_id = auth.uid()
  where (f.owner_user_id is null or f.owner_user_id = auth.uid())
    and (f.source <> 'ai_estimate' or u.user_id is not null)
    and (
      extensions.unaccent(f.name) ilike '%' || (select text from q) || '%'
      or f.search_tsv @@ websearch_to_tsquery('simple', (select text from q))
      or extensions.similarity(extensions.unaccent(f.name), (select text from q)) > 0.3
    )
  order by rank_bucket asc,
    coalesce(u.favourite, false) desc,
    u.last_used_at desc nulls last,
    similarity desc,
    length(f.name) asc
  limit greatest(1, least(p_limit, 100))
$$;
grant execute on function public.search_foods(text, integer) to authenticated;

-- Records a confirmed use of a food and learns the usual portion.
create or replace function public.touch_food_usage(p_food_id uuid, p_grams numeric)
returns void
language plpgsql
as $$
begin
  insert into public.user_food_usage (user_id, food_id, use_count, last_used_at, usual_grams)
  values (auth.uid(), p_food_id, 1, now(), p_grams)
  on conflict (user_id, food_id) do update
    set use_count = public.user_food_usage.use_count + 1,
        last_used_at = now(),
        usual_grams = case
          when public.user_food_usage.usual_grams is null then excluded.usual_grams
          else round((public.user_food_usage.usual_grams * 0.7 + excluded.usual_grams * 0.3)::numeric, 1)
        end;
end;
$$;
grant execute on function public.touch_food_usage(uuid, numeric) to authenticated;
