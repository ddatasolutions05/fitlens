-- Fixes from the Phase 1 review: expose the usage RPCs through public, add a
-- cost accumulator, keep pace precision, and make the daily kcal range cover
-- every item.

-- PostgREST only exposes public, so the edge functions call these wrappers.
create or replace function public.increment_ai_usage(
  p_user uuid, p_local_date date, p_kind text, p_cap integer, p_cost numeric default 0
)
returns boolean
language sql
security definer
set search_path = public, fitlens
as $$
  select fitlens.increment_ai_usage(p_user, p_local_date, p_kind, p_cap, p_cost)
$$;
revoke all on function public.increment_ai_usage(uuid, date, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.increment_ai_usage(uuid, date, text, integer, numeric) to service_role;

create or replace function public.add_ai_cost(p_user uuid, p_local_date date, p_cost numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage
  set est_cost_usd = est_cost_usd + coalesce(p_cost, 0), updated_at = now()
  where user_id = p_user and local_date = p_local_date
$$;
revoke all on function public.add_ai_cost(uuid, date, numeric) from public, anon, authenticated;
grant execute on function public.add_ai_cost(uuid, date, numeric) to service_role;

-- 0.0025 and 0.0075 per week must survive a round trip.
alter table public.goal_versions alter column pace type numeric(6,4);

-- Range per day: items without a range contribute their point estimate.
-- ranged_count tells the app whether a range is worth showing at all.
drop view if exists public.daily_totals;
create view public.daily_totals
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
  sum(coalesce(mi.kcal_low, mi.kcal)) as kcal_low,
  sum(coalesce(mi.kcal_high, mi.kcal)) as kcal_high,
  count(mi.id) filter (where mi.kcal_low is not null) as ranged_count
from public.meals m
join public.meal_items mi on mi.meal_id = m.id
where m.status = 'confirmed'
group by m.user_id, m.local_date;
grant select on public.daily_totals to authenticated, service_role;
