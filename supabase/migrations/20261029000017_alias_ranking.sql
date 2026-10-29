-- Rank an exact alias ("dahi" for curd) above a name that merely contains
-- the word ("Dahi puri"): score each comma-separated alias on its own.
drop function public.search_foods(text, integer);
create or replace function public.search_foods(p_query text, p_limit integer default 25)
returns table (
  id uuid,
  name text,
  brand text,
  source text,
  verified boolean,
  owner_user_id uuid,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fibre_g numeric,
  sodium_mg numeric,
  sat_fat_g numeric,
  default_serving_g numeric,
  variant_label text,
  attribution text,
  favourite boolean,
  use_count integer,
  usual_grams numeric,
  rank_bucket integer,
  similarity real
)
language sql
stable
as $$
  with q as (select extensions.unaccent(lower(trim(p_query))) as text),
  scored as (
    select f.*,
      greatest(
        extensions.similarity(extensions.unaccent(f.name), (select text from q)),
        coalesce((
          select max(extensions.similarity(extensions.unaccent(lower(trim(a))), (select text from q)))
          from unnest(string_to_array(f.aliases, ',')) as a
        ), 0)
      ) as score,
      (f.aliases is not null and exists (
        select 1 from unnest(string_to_array(f.aliases, ',')) as a
        where extensions.unaccent(lower(trim(a))) = (select text from q)
      )) as alias_exact
    from public.foods f
    where (f.owner_user_id is null or f.owner_user_id = auth.uid())
      and (
        extensions.unaccent(f.name) ilike '%' || (select text from q) || '%'
        or (f.aliases is not null and extensions.unaccent(f.aliases) ilike '%' || (select text from q) || '%')
        or f.search_tsv @@ websearch_to_tsquery('simple', (select text from q))
        or extensions.similarity(extensions.unaccent(f.name), (select text from q)) > 0.3
      )
  )
  select
    f.id, f.name, f.brand, f.source, f.verified, f.owner_user_id,
    f.kcal, f.protein_g, f.carbs_g, f.fat_g, f.fibre_g, f.sodium_mg, f.sat_fat_g,
    f.default_serving_g, f.variant_label, f.attribution,
    coalesce(u.favourite, false) as favourite,
    coalesce(u.use_count, 0) as use_count,
    u.usual_grams,
    case
      when u.user_id is not null then 0
      when f.verified then 1
      else 2
    end as rank_bucket,
    f.score as similarity
  from scored f
  left join public.user_food_usage u on u.food_id = f.id and u.user_id = auth.uid()
  where (f.source <> 'ai_estimate' or u.user_id is not null)
  order by rank_bucket asc,
    coalesce(u.favourite, false) desc,
    u.last_used_at desc nulls last,
    f.alias_exact desc,
    f.score desc,
    length(f.name) asc
  limit greatest(1, least(p_limit, 100))
$$;
grant execute on function public.search_foods(text, integer) to authenticated;
