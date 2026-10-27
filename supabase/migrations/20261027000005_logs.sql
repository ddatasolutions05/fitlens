-- Weight, activity, water, day status.

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  local_date date not null,
  tz text not null,
  kg numeric(6,2) not null check (kg > 20 and kg < 400),
  source text not null default 'manual' check (source in ('manual', 'healthkit', 'health_connect')),
  external_id text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_logs_external unique (user_id, source, external_id)
);
create index weight_logs_user_date on public.weight_logs (user_id, local_date desc, measured_at desc);
create trigger weight_logs_updated_at before update on public.weight_logs
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.weight_logs');

create table public.activity_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('steps', 'workout')),
  start_at timestamptz not null default now(),
  end_at timestamptz,
  local_date date not null,
  tz text not null,
  steps integer check (steps is null or steps >= 0),
  workout_type text check (workout_type is null or workout_type in ('walking', 'running', 'cycling', 'strength', 'yoga', 'sports', 'other')),
  intensity text check (intensity is null or intensity in ('light', 'moderate', 'vigorous')),
  duration_min numeric(7,2) check (duration_min is null or duration_min >= 0),
  met numeric(5,2),
  kcal_estimate numeric(8,2),
  source text not null default 'manual' check (source in ('manual', 'healthkit', 'health_connect')),
  external_id text not null default gen_random_uuid()::text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_records_external unique (user_id, source, external_id),
  constraint activity_records_shape check (
    (kind = 'steps' and steps is not null) or (kind = 'workout' and duration_min is not null)
  )
);
comment on column public.activity_records.kcal_estimate is 'Always an estimate: (MET - 1) x kg x hours for workouts, steps x kg x 0.0005 for steps.';
create index activity_records_user_date on public.activity_records (user_id, local_date, kind);
create trigger activity_records_updated_at before update on public.activity_records
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.activity_records');

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  local_date date not null,
  tz text not null,
  ml integer not null check (ml > 0 and ml <= 5000),
  created_at timestamptz not null default now()
);
create index water_logs_user_date on public.water_logs (user_id, local_date);
select fitlens.add_owner_policies('public.water_logs');

create table public.day_status (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  status text not null check (status in ('partial', 'complete')),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
comment on table public.day_status is 'No row means not logged. partial is informational; complete feeds adaptive TDEE.';
create trigger day_status_updated_at before update on public.day_status
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.day_status');
