-- Daily reminders over web push. The browser subscription lives in
-- push_subscriptions; the chosen time in reminders. The sender is the
-- send-reminders function, called on a schedule (see scripts/db/setup-reminder-cron.mjs).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 2000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz,
  failures integer not null default 0
);
comment on table public.push_subscriptions is 'Web push subscriptions, one per browser. Removed when the push service says gone.';
create index push_subscriptions_user on public.push_subscriptions (user_id);
select fitlens.add_owner_policies('public.push_subscriptions');

create table public.reminders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  local_time time not null default '20:00',
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.reminders.local_time is 'In the profile timezone. One notification a day inside the 15 minutes after it.';
create trigger reminders_updated_at before update on public.reminders
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.reminders');
