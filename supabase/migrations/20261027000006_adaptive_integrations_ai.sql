-- Adaptive TDEE suggestions, integrations, AI usage counters.

create table public.target_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  proposed_calorie_target integer not null,
  proposed_protein_g integer,
  observed_tdee integer,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  goal_version_id uuid references public.goal_versions (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
comment on column public.target_suggestions.evidence is 'Window dates, complete-day count, weigh-in count, trend start/end kg, mean intake, uncertainty note.';
create index target_suggestions_user on public.target_suggestions (user_id, created_at desc);
select fitlens.add_owner_policies('public.target_suggestions');

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('healthkit', 'health_connect')),
  status text not null default 'disconnected' check (status in ('disconnected', 'connected', 'error', 'requires_native_build')),
  scopes text[] not null default '{}',
  priority smallint not null default 0,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_provider unique (user_id, provider)
);
comment on column public.integration_connections.priority is 'Lower wins when choosing the single step source for a day.';
create trigger integration_connections_updated_at before update on public.integration_connections
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.integration_connections');

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  analyses integer not null default 0,
  label_reads integer not null default 0,
  coach_calls integer not null default 0,
  est_cost_usd numeric(8,4) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
-- Users can see their own counters; only functions (service role) write them.
alter table public.ai_usage enable row level security;
create policy ai_usage_select on public.ai_usage for select to authenticated using (auth.uid() = user_id);
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;

-- Atomic increment with a cap. Called by edge functions with the service role.
create or replace function fitlens.increment_ai_usage(
  p_user uuid, p_local_date date, p_kind text, p_cap integer, p_cost numeric default 0
)
returns boolean
language plpgsql
security definer
set search_path = public, fitlens
as $$
declare
  current_count integer;
begin
  if p_kind not in ('analyses', 'label_reads', 'coach_calls') then
    raise exception 'unknown usage kind %', p_kind;
  end if;
  insert into public.ai_usage (user_id, local_date)
  values (p_user, p_local_date)
  on conflict (user_id, local_date) do nothing;

  execute format('select %I from public.ai_usage where user_id = $1 and local_date = $2 for update', p_kind)
    into current_count using p_user, p_local_date;

  if current_count >= p_cap then
    return false;
  end if;

  execute format(
    'update public.ai_usage set %I = %I + 1, est_cost_usd = est_cost_usd + $3, updated_at = now() where user_id = $1 and local_date = $2',
    p_kind, p_kind
  ) using p_user, p_local_date, coalesce(p_cost, 0);
  return true;
end;
$$;
revoke all on function fitlens.increment_ai_usage(uuid, date, text, integer, numeric) from public, anon, authenticated;
grant execute on function fitlens.increment_ai_usage(uuid, date, text, integer, numeric) to service_role;
