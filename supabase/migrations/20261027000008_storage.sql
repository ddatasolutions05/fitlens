-- Private bucket for meal photos. Path layout: <user_id>/<meal_id>/<uuid>.jpg
-- Objects are served through short-lived signed URLs created by the client.

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

drop policy if exists meal_photos_select on storage.objects;
drop policy if exists meal_photos_insert on storage.objects;
drop policy if exists meal_photos_update on storage.objects;
drop policy if exists meal_photos_delete on storage.objects;

create policy meal_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy meal_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy meal_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy meal_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
