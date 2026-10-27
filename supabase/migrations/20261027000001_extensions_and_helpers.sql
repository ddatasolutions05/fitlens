-- Extensions and shared helpers.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists fitlens;
grant usage on schema fitlens to authenticated, service_role;

-- Keeps updated_at current on every row update.
create or replace function fitlens.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Creates the four owner-only RLS policies on a table that has user_id.
create or replace function fitlens.add_owner_policies(tbl regclass)
returns void
language plpgsql
as $$
declare
  t text := tbl::text;
begin
  execute format('alter table %s enable row level security', t);
  execute format('drop policy if exists owner_select on %s', t);
  execute format('drop policy if exists owner_insert on %s', t);
  execute format('drop policy if exists owner_update on %s', t);
  execute format('drop policy if exists owner_delete on %s', t);
  execute format('create policy owner_select on %s for select to authenticated using (auth.uid() = user_id)', t);
  execute format('create policy owner_insert on %s for insert to authenticated with check (auth.uid() = user_id)', t);
  execute format('create policy owner_update on %s for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  execute format('create policy owner_delete on %s for delete to authenticated using (auth.uid() = user_id)', t);
  execute format('grant select, insert, update, delete on %s to authenticated', t);
  execute format('grant all on %s to service_role', t);
end;
$$;

-- Child rows (meal_items etc.) must carry the same user_id as their parent.
-- Used as a BEFORE INSERT OR UPDATE trigger with (parent_table, parent_fk_column).
create or replace function fitlens.enforce_parent_owner()
returns trigger
language plpgsql
as $$
declare
  parent_table text := tg_argv[0];
  fk_column text := tg_argv[1];
  fk_value uuid;
  parent_user uuid;
begin
  execute format('select ($1).%I', fk_column) into fk_value using new;
  execute format('select user_id from %s where id = $1', parent_table) into parent_user using fk_value;
  if parent_user is null then
    raise exception 'parent row not found or not accessible' using errcode = '23503';
  end if;
  if new.user_id is distinct from parent_user then
    raise exception 'user_id must match the parent row owner' using errcode = '42501';
  end if;
  return new;
end;
$$;
