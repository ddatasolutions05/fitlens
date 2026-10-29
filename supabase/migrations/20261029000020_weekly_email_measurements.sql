-- Weekly summary email opt-out and send marker; body measurements with an
-- optional private progress photo.
alter table public.preferences add column weekly_email boolean not null default true;
alter table public.preferences add column weekly_email_sent_on date;
comment on column public.preferences.weekly_email is 'Sunday evening summary by email. Off hides the person from weekly_email_candidates().';

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  local_date date not null,
  tz text not null,
  waist_cm numeric(5,1) check (waist_cm is null or (waist_cm > 30 and waist_cm < 250)),
  hips_cm numeric(5,1) check (hips_cm is null or (hips_cm > 30 and hips_cm < 250)),
  photo_path text,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint measurements_something check (waist_cm is not null or hips_cm is not null or photo_path is not null)
);
comment on column public.measurements.photo_path is 'Object path in the private body-photos bucket: <user_id>/<date>-<id>.jpg';
create index measurements_user_date on public.measurements (user_id, local_date desc);
create trigger measurements_updated_at before update on public.measurements
  for each row execute function fitlens.set_updated_at();
select fitlens.add_owner_policies('public.measurements');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('body-photos', 'body-photos', false, 4194304, array['image/jpeg'])
on conflict (id) do nothing;
create policy body_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy body_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy body_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy body_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'body-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Who gets the Sunday email. Service role only; the function needs the address.
create or replace function public.weekly_email_candidates()
returns table (user_id uuid, email text, display_name text, timezone text, unit_system text, hide_numbers boolean, mode text, sent_on date)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, u.email, p.display_name, p.timezone, p.unit_system, p.hide_numbers, p.mode, pr.weekly_email_sent_on
  from public.profiles p
  join auth.users u on u.id = p.user_id
  left join public.preferences pr on pr.user_id = p.user_id
  where p.onboarding_completed_at is not null
    and u.email is not null
    and u.email not like 'e2e-%'
    and u.email not like '%@fitlens.demo'
    and coalesce(pr.weekly_email, true)
$$;
revoke all on function public.weekly_email_candidates() from public, anon, authenticated;
grant execute on function public.weekly_email_candidates() to service_role;
