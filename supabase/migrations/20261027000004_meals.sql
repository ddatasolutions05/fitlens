-- Meals, items, photos, analyses, saved meals, recipes.

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  idempotency_key uuid not null,
  local_date date not null,
  eaten_at timestamptz not null default now(),
  tz text not null,
  meal_type text not null default 'snack' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  source text not null check (source in ('photo', 'manual', 'barcode', 'label', 'recipe', 'copy', 'saved_meal')),
  title text,
  notes text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meals_idempotency unique (user_id, idempotency_key)
);
comment on table public.meals is 'Drafts never count toward totals. local_date and tz are fixed at entry time and only change when the user edits the date.';
create index meals_user_date on public.meals (user_id, local_date, status);
create trigger meals_updated_at before update on public.meals
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.meals');

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  sort_order smallint not null default 0,
  name_snapshot text not null,
  grams numeric(8,2) not null check (grams >= 0),
  serving_label text,
  fraction_eaten numeric(4,3) not null default 1 check (fraction_eaten > 0 and fraction_eaten <= 1),
  -- per-100 g values copied at confirmation time
  per100_kcal numeric(8,2),
  per100_protein_g numeric(8,2),
  per100_carbs_g numeric(8,2),
  per100_fat_g numeric(8,2),
  per100_fibre_g numeric(8,2),
  per100_sodium_mg numeric(8,2),
  per100_sat_fat_g numeric(8,2),
  -- computed for this item (grams x per100 / 100 x fraction); null = unknown
  kcal numeric(8,2),
  protein_g numeric(8,2),
  carbs_g numeric(8,2),
  fat_g numeric(8,2),
  fibre_g numeric(8,2),
  sodium_mg numeric(8,2),
  sat_fat_g numeric(8,2),
  kcal_low numeric(8,2),
  kcal_high numeric(8,2),
  provenance text not null check (provenance in ('database', 'label', 'community', 'user', 'ai_estimate')),
  source_name text,
  confidence text check (confidence is null or confidence in ('low', 'medium', 'high')),
  assumptions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.meal_items is 'Nutrient snapshot per item. Later changes to foods never alter history.';
create index meal_items_meal on public.meal_items (meal_id);
create trigger meal_items_updated_at before update on public.meal_items
  for each row execute function fitlens.set_updated_at();
create trigger meal_items_parent before insert or update on public.meal_items
  for each row execute function fitlens.enforce_parent_owner('public.meals', 'meal_id');
select fitlens.add_owner_policies('public.meal_items');

create table public.meal_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_id uuid not null references public.meals (id) on delete cascade,
  storage_path text not null unique,
  width integer,
  height integer,
  bytes integer,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index meal_photos_meal on public.meal_photos (meal_id);
create trigger meal_photos_parent before insert or update on public.meal_photos
  for each row execute function fitlens.enforce_parent_owner('public.meals', 'meal_id');
select fitlens.add_owner_policies('public.meal_photos');

create table public.photo_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_id uuid not null references public.meals (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  provider text,
  model text,
  prompt_version text,
  validated_response jsonb,
  error_code text,
  error_detail text,
  est_cost_usd numeric(8,5),
  input_tokens integer,
  output_tokens integer,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index photo_analyses_meal on public.photo_analyses (meal_id, created_at desc);
create trigger photo_analyses_parent before insert or update on public.photo_analyses
  for each row execute function fitlens.enforce_parent_owner('public.meals', 'meal_id');
select fitlens.add_owner_policies('public.photo_analyses');

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  meal_type text check (meal_type is null or meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  use_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger saved_meals_updated_at before update on public.saved_meals
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.saved_meals');

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  saved_meal_id uuid not null references public.saved_meals (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  sort_order smallint not null default 0,
  name_snapshot text not null,
  grams numeric(8,2) not null check (grams >= 0),
  serving_label text,
  fraction_eaten numeric(4,3) not null default 1,
  per100_kcal numeric(8,2),
  per100_protein_g numeric(8,2),
  per100_carbs_g numeric(8,2),
  per100_fat_g numeric(8,2),
  per100_fibre_g numeric(8,2),
  per100_sodium_mg numeric(8,2),
  per100_sat_fat_g numeric(8,2),
  provenance text not null,
  source_name text,
  assumptions jsonb not null default '[]'::jsonb
);
create index saved_meal_items_parent on public.saved_meal_items (saved_meal_id);
create trigger saved_meal_items_parent before insert or update on public.saved_meal_items
  for each row execute function fitlens.enforce_parent_owner('public.saved_meals', 'saved_meal_id');
select fitlens.add_owner_policies('public.saved_meal_items');

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  cooked_yield_g numeric(8,2) not null check (cooked_yield_g > 0),
  servings numeric(6,2) not null check (servings > 0),
  food_id uuid references public.foods (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.recipes.food_id is 'The user-owned foods row (source = recipe) holding per-100 g cooked values for logging.';
create trigger recipes_updated_at before update on public.recipes
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.recipes');

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  sort_order smallint not null default 0,
  name_snapshot text not null,
  raw_grams numeric(8,2) not null check (raw_grams >= 0),
  per100_kcal numeric(8,2),
  per100_protein_g numeric(8,2),
  per100_carbs_g numeric(8,2),
  per100_fat_g numeric(8,2),
  per100_fibre_g numeric(8,2),
  per100_sodium_mg numeric(8,2),
  per100_sat_fat_g numeric(8,2)
);
comment on column public.recipe_ingredients.raw_grams is 'Always raw weight. Cooked weight lives on the recipe as cooked_yield_g.';
create index recipe_ingredients_parent on public.recipe_ingredients (recipe_id);
create trigger recipe_ingredients_parent before insert or update on public.recipe_ingredients
  for each row execute function fitlens.enforce_parent_owner('public.recipes', 'recipe_id');
select fitlens.add_owner_policies('public.recipe_ingredients');
