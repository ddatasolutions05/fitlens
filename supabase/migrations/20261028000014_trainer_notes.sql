-- One-line notes from a trainer to a member. Only a trainer with an active
-- link can write one; the member sees the latest on Home and can clear it.

create table public.trainer_notes (
  id uuid primary key default gen_random_uuid(),
  member_user_id uuid not null references auth.users (id) on delete cascade,
  trainer_user_id uuid not null references auth.users (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 300),
  created_at timestamptz not null default now()
);
create index trainer_notes_member on public.trainer_notes (member_user_id, created_at desc);
create index trainer_notes_trainer on public.trainer_notes (trainer_user_id, created_at desc);
alter table public.trainer_notes enable row level security;

create policy trainer_notes_select on public.trainer_notes for select to authenticated
  using (auth.uid() = member_user_id or auth.uid() = trainer_user_id);
create policy trainer_notes_insert on public.trainer_notes for insert to authenticated
  with check (
    auth.uid() = trainer_user_id
    and exists (
      select 1 from public.trainer_links l
      where l.trainer_user_id = auth.uid() and l.member_user_id = trainer_notes.member_user_id and l.status = 'active'
    )
  );
create policy trainer_notes_delete on public.trainer_notes for delete to authenticated
  using (auth.uid() = member_user_id or auth.uid() = trainer_user_id);
grant select, insert, delete on public.trainer_notes to authenticated;
grant all on public.trainer_notes to service_role;
