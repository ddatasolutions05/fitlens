-- Client error reports. First party only (the owner's project), no third-party SDK.
-- Message and stack are trimmed on the client; sizes are capped here as well.

create table public.client_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null default 'error' check (kind in ('error')),
  scope text not null check (char_length(scope) between 1 and 80),
  message text not null check (char_length(message) between 1 and 500),
  stack text check (stack is null or char_length(stack) <= 2000),
  platform text check (platform is null or char_length(platform) <= 20),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  route text check (route is null or char_length(route) <= 200),
  extra jsonb check (extra is null or pg_column_size(extra) <= 4096)
);
comment on table public.client_events is 'Errors the app caught on a device. Read with scripts/telemetry.mjs; purged after 30 days.';
create index client_events_created on public.client_events (created_at desc);
create index client_events_user on public.client_events (user_id, created_at desc);

alter table public.client_events enable row level security;
-- Signed-out screens (sign-in, reset) can report too, with no user attached.
create policy client_events_insert on public.client_events for insert to anon, authenticated
  with check ((auth.uid() is null and user_id is null) or user_id = auth.uid());
create policy client_events_select on public.client_events for select to authenticated
  using (user_id = auth.uid());
grant insert on public.client_events to anon, authenticated;
grant select on public.client_events to authenticated;
grant all on public.client_events to service_role;

create or replace function fitlens.purge_client_events(keep_days integer default 30)
returns integer
language sql
security definer
set search_path = public
as $$
  with gone as (
    delete from public.client_events where created_at < now() - make_interval(days => keep_days) returning 1
  )
  select count(*)::integer from gone;
$$;
revoke all on function fitlens.purge_client_events(integer) from public, anon, authenticated;
grant execute on function fitlens.purge_client_events(integer) to service_role;
