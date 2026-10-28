-- Trainer access. A member links to a trainer with a code the trainer hands
-- out; the trainer then reads weekly summaries, never raw rows, and the
-- member can revoke at any time.

create table public.trainer_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
comment on table public.trainer_codes is 'One short code per trainer; members enter it to grant access. Rotates when a new one is made.';
create index trainer_codes_user on public.trainer_codes (user_id);
select fitlens.add_owner_policies('public.trainer_codes');

create table public.trainer_links (
  id uuid primary key default gen_random_uuid(),
  member_user_id uuid not null references auth.users (id) on delete cascade,
  trainer_user_id uuid not null references auth.users (id) on delete cascade,
  trainer_name text,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_links_pair unique (member_user_id, trainer_user_id),
  constraint trainer_links_not_self check (member_user_id <> trainer_user_id)
);
create index trainer_links_trainer on public.trainer_links (trainer_user_id, status);
create trigger trainer_links_updated_at before update on public.trainer_links
  for each row execute function fitlens.set_updated_at();
alter table public.trainer_links enable row level security;
-- Either side can see the link and revoke it; only the function below creates one.
create policy trainer_links_select on public.trainer_links for select to authenticated
  using (auth.uid() = member_user_id or auth.uid() = trainer_user_id);
create policy trainer_links_update on public.trainer_links for update to authenticated
  using (auth.uid() = member_user_id or auth.uid() = trainer_user_id)
  with check (status = 'revoked');
grant select, update on public.trainer_links to authenticated;
grant all on public.trainer_links, public.trainer_codes to service_role;

-- A trainer's current code, made or rotated on demand.
create or replace function public.make_trainer_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.trainer_codes where user_id = auth.uid();
  loop
    -- Six hex characters from a random uuid; no extension needed.
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.trainer_codes where code = v_code);
  end loop;
  insert into public.trainer_codes (code, user_id) values (v_code, auth.uid());
  return v_code;
end;
$$;
revoke all on function public.make_trainer_code() from public;
grant execute on function public.make_trainer_code() to authenticated;

-- The member side: enter a code, get linked. Returns the trainer's display name.
create or replace function public.link_trainer(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trainer uuid;
  v_name text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select user_id into v_trainer from public.trainer_codes
    where code = upper(trim(p_code)) and expires_at > now();
  if v_trainer is null then raise exception 'code_not_found'; end if;
  if v_trainer = auth.uid() then raise exception 'own_code'; end if;
  select coalesce(display_name, 'Your trainer') into v_name from public.profiles where user_id = v_trainer;
  insert into public.trainer_links (member_user_id, trainer_user_id, trainer_name, status)
    values (auth.uid(), v_trainer, v_name, 'active')
    on conflict (member_user_id, trainer_user_id) do update set status = 'active', trainer_name = excluded.trainer_name;
  return v_name;
end;
$$;
revoke all on function public.link_trainer(text) from public;
grant execute on function public.link_trainer(text) to authenticated;

-- The trainer side: one summary row per linked member for the last p_days days.
create or replace function public.trainer_members(p_days integer default 7)
returns table (
  member_user_id uuid,
  display_name text,
  linked_at timestamptz,
  days_logged integer,
  meals integer,
  avg_kcal integer,
  avg_protein_g integer,
  calorie_target integer,
  protein_target_g integer,
  workouts integer,
  workout_minutes integer,
  weight_first numeric,
  weight_last numeric,
  last_log_date date
)
language sql
security definer
set search_path = public
as $$
  with members as (
    select l.member_user_id, l.created_at as linked_at
    from public.trainer_links l
    where l.trainer_user_id = auth.uid() and l.status = 'active'
  ),
  days as (
    select t.user_id, t.local_date, t.kcal, t.protein_g, t.meal_count
    from public.daily_totals t join members m on m.member_user_id = t.user_id
    where t.local_date > current_date - greatest(1, least(p_days, 90))
  ),
  act as (
    select a.user_id, count(*) filter (where a.kind = 'workout') as workouts,
      coalesce(sum(a.duration_min) filter (where a.kind = 'workout'), 0) as minutes,
      max(a.local_date) as last_date
    from public.activity_records a join members m on m.member_user_id = a.user_id
    where a.local_date > current_date - greatest(1, least(p_days, 90))
    group by a.user_id
  ),
  w as (
    select wl.user_id,
      (array_agg(wl.kg order by wl.measured_at))[1] as first_kg,
      (array_agg(wl.kg order by wl.measured_at desc))[1] as last_kg
    from public.weight_logs wl join members m on m.member_user_id = wl.user_id
    where wl.local_date > current_date - greatest(1, least(p_days, 90))
    group by wl.user_id
  ),
  goal as (
    select distinct on (g.user_id) g.user_id, g.calorie_target, g.protein_g
    from public.goal_versions g join members m on m.member_user_id = g.user_id
    where g.effective_from <= current_date
    order by g.user_id, g.effective_from desc, g.created_at desc
  )
  select
    m.member_user_id,
    coalesce(p.display_name, 'Member') as display_name,
    m.linked_at,
    coalesce((select count(distinct d.local_date) from days d where d.user_id = m.member_user_id), 0)::integer as days_logged,
    coalesce((select sum(d.meal_count) from days d where d.user_id = m.member_user_id), 0)::integer as meals,
    (select round(avg(d.kcal)) from days d where d.user_id = m.member_user_id and d.kcal is not null)::integer as avg_kcal,
    (select round(avg(d.protein_g)) from days d where d.user_id = m.member_user_id and d.protein_g is not null)::integer as avg_protein_g,
    case when p.mode = 'tracking_only' then null else goal.calorie_target end as calorie_target,
    goal.protein_g as protein_target_g,
    coalesce(act.workouts, 0)::integer as workouts,
    coalesce(act.minutes, 0)::integer as workout_minutes,
    w.first_kg as weight_first,
    w.last_kg as weight_last,
    greatest((select max(d.local_date) from days d where d.user_id = m.member_user_id), act.last_date) as last_log_date
  from members m
  left join public.profiles p on p.user_id = m.member_user_id
  left join act on act.user_id = m.member_user_id
  left join w on w.user_id = m.member_user_id
  left join goal on goal.user_id = m.member_user_id
  order by display_name;
$$;
revoke all on function public.trainer_members(integer) from public;
grant execute on function public.trainer_members(integer) to authenticated;
