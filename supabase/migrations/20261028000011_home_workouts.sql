-- Home screen avatar and workout plan settings.

alter table public.profiles add column avatar_path text;
comment on column public.profiles.avatar_path is 'Object path in the private avatars bucket: <user_id>/avatar.jpg';

alter table public.preferences
  add column workout_days_per_week smallint check (workout_days_per_week is null or workout_days_per_week between 1 and 7),
  add column workout_minutes smallint check (workout_minutes is null or workout_minutes between 10 and 180),
  add column workout_level text check (workout_level is null or workout_level in ('beginner', 'intermediate', 'advanced')),
  add column workout_focus text check (workout_focus is null or workout_focus in ('general', 'strength', 'fat_loss', 'endurance', 'mobility')),
  add column workout_equipment text[] not null default '{}',
  add column workout_plan_seed integer not null default 1;
comment on column public.preferences.workout_equipment is 'Any of bodyweight, dumbbells, barbell, machines, bands, kettlebell. Empty means bodyweight only.';

-- Private bucket for profile pictures. Path layout: <user_id>/avatar.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
