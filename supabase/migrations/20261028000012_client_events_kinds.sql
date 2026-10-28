-- First-party funnel events share the error table: kind 'event', scope = event name.

alter table public.client_events drop constraint client_events_kind_check;
alter table public.client_events add constraint client_events_kind_check check (kind in ('error', 'event'));
create index client_events_kind_scope on public.client_events (kind, scope, created_at desc);
comment on table public.client_events is 'Errors the app caught on a device, and a few named usage events (onboarding, first meal, scan, coach, workout). Read with scripts/telemetry.mjs and scripts/funnel.mjs; purged after 30 days.';
