-- Profiles, preferences and versioned goals.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  birth_date date,
  sex_for_equation text not null default 'unspecified'
    check (sex_for_equation in ('male', 'female', 'unspecified')),
  height_cm numeric(5,1) check (height_cm is null or (height_cm > 50 and height_cm < 280)),
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  timezone text not null default 'UTC',
  mode text not null default 'standard' check (mode in ('standard', 'tracking_only')),
  tracking_only_reasons text[] not null default '{}',
  hide_numbers boolean not null default false,
  goal_weight_kg numeric(6,2) check (goal_weight_kg is null or (goal_weight_kg > 20 and goal_weight_kg < 400)),
  typical_steps integer check (typical_steps is null or typical_steps between 0 and 100000),
  training_days_per_week smallint check (training_days_per_week is null or training_days_per_week between 0 and 7),
  training_type text,
  training_minutes smallint check (training_minutes is null or training_minutes between 0 and 600),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per user. mode = tracking_only disables deficit targets, pace and adaptive TDEE.';
comment on column public.profiles.sex_for_equation is 'Only used for the Mifflin-St Jeor constants. unspecified averages both.';

create trigger profiles_updated_at before update on public.profiles
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.profiles');

create table public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  diet_pattern text,
  allergies text[] not null default '{}',
  cuisines text[] not null default '{}',
  avoid_foods text[] not null default '{}',
  ai_photo_consent_at timestamptz,
  ai_consent_version text,
  reduced_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.preferences.ai_photo_consent_at is 'Null means no consent; photo analysis is refused server side.';

create trigger preferences_updated_at before update on public.preferences
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.preferences');

create table public.goal_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  goal_type text not null check (goal_type in ('fat_loss', 'maintenance', 'muscle_gain')),
  pace numeric(4,3) check (pace is null or (pace >= 0 and pace <= 1)),
  activity_mode text not null default 'activity_level'
    check (activity_mode in ('activity_level', 'logged_activity')),
  activity_level text not null default 'sedentary'
    check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  calorie_target integer check (calorie_target is null or calorie_target between 500 and 10000),
  protein_g integer,
  carbs_g integer,
  fat_g integer,
  fibre_g integer,
  step_goal integer,
  water_ml integer,
  source text not null check (source in ('calculated', 'manual', 'adaptive_accepted')),
  rationale text,
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.goal_versions is 'Append-only. The row with the latest effective_from <= local_date is the target for that day.';
comment on column public.goal_versions.pace is 'Fat loss only: fraction of body weight per week, 0.0025 to 0.01.';
comment on column public.goal_versions.inputs is 'The numbers used by the calculation (weight, REE, TDEE, multiplier) so the explanation can be shown later.';

create index goal_versions_user_effective on public.goal_versions (user_id, effective_from desc, created_at desc);
select fitlens.add_owner_policies('public.goal_versions');
