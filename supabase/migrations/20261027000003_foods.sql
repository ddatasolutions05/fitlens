-- Food database: shared rows (owner_user_id null) plus user-owned rows.

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete cascade,
  source text not null check (source in ('usda', 'cnf', 'ifct', 'indb', 'off', 'label', 'user', 'ai_estimate', 'recipe')),
  source_ref text,
  name text not null,
  brand text,
  barcode text,
  verified boolean not null default false,
  -- per 100 g; null means unknown and is never treated as zero
  kcal numeric(8,2),
  protein_g numeric(8,2),
  carbs_g numeric(8,2),
  fat_g numeric(8,2),
  fibre_g numeric(8,2),
  sodium_mg numeric(8,2),
  sat_fat_g numeric(8,2),
  default_serving_g numeric(8,2),
  variant_of uuid references public.foods (id) on delete set null,
  variant_label text,
  attribution text,
  search_tsv tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(brand, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foods_owner_source check (
    (owner_user_id is null and source in ('usda', 'cnf', 'ifct', 'indb', 'off'))
    or (owner_user_id is not null and source in ('label', 'user', 'ai_estimate', 'recipe', 'off'))
  )
);
comment on table public.foods is 'Shared database foods have owner_user_id null and are written by the importer with the service role. Users own label, manual, recipe and ai_estimate rows.';
comment on column public.foods.variant_of is 'Points at a base dish when this row is a named variant (tadka vs plain, with ghee vs without).';

create unique index foods_source_ref on public.foods (source, source_ref) where owner_user_id is null and source_ref is not null;
create index foods_barcode on public.foods (barcode) where barcode is not null;
create index foods_name_trgm on public.foods using gin (name extensions.gin_trgm_ops);
create index foods_search_tsv on public.foods using gin (search_tsv);
create index foods_owner on public.foods (owner_user_id) where owner_user_id is not null;

create trigger foods_updated_at before update on public.foods
  for each row execute function fitlens.set_updated_at();

alter table public.foods enable row level security;
create policy foods_select on public.foods for select to authenticated
  using (owner_user_id is null or owner_user_id = auth.uid());
create policy foods_insert on public.foods for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy foods_update on public.foods for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy foods_delete on public.foods for delete to authenticated
  using (owner_user_id = auth.uid());
grant select, insert, update, delete on public.foods to authenticated;
grant all on public.foods to service_role;

create table public.food_servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  owner_user_id uuid references auth.users (id) on delete cascade,
  label text not null,
  grams numeric(8,2) not null check (grams > 0),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.food_servings is 'Household units such as "1 medium roti" or "1 katori". owner_user_id null = shared.';
create index food_servings_food on public.food_servings (food_id);

alter table public.food_servings enable row level security;
create policy food_servings_select on public.food_servings for select to authenticated
  using (owner_user_id is null or owner_user_id = auth.uid());
create policy food_servings_insert on public.food_servings for insert to authenticated
  with check (owner_user_id = auth.uid());
create policy food_servings_update on public.food_servings for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy food_servings_delete on public.food_servings for delete to authenticated
  using (owner_user_id = auth.uid());
grant select, insert, update, delete on public.food_servings to authenticated;
grant all on public.food_servings to service_role;

-- Recents, favourites and learned portion defaults.
create table public.user_food_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  use_count integer not null default 0,
  last_used_at timestamptz,
  favourite boolean not null default false,
  usual_grams numeric(8,2),
  primary key (user_id, food_id)
);
comment on column public.user_food_usage.usual_grams is 'Learned from confirmed portions ("your usual roti is 40 g"). Never rewrites history.';
create index user_food_usage_recent on public.user_food_usage (user_id, last_used_at desc nulls last);
select fitlens.add_owner_policies('public.user_food_usage');
