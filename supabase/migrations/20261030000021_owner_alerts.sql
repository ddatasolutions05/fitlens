-- Owner alerts: the reminder sweep pushes a short digest (new sign-ups, first
-- meals, errors) to admins who turned it on and have a browser subscribed.
alter table public.app_admins add column alerts boolean not null default true;
alter table public.app_admins add column alerted_at timestamptz;

create or replace function public.admin_alert_settings()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select jsonb_build_object('alerts', a.alerts, 'alerted_at', a.alerted_at) from public.app_admins a where a.user_id = auth.uid()), 'null'::jsonb);
$$;
grant execute on function public.admin_alert_settings() to authenticated;

create or replace function public.set_admin_alerts(p_on boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise insufficient_privilege using message = 'admin only';
  end if;
  update public.app_admins set alerts = p_on where user_id = auth.uid();
  return p_on;
end;
$$;
grant execute on function public.set_admin_alerts(boolean) to authenticated;

-- What happened since the last alert. Service role only; names are first names or the email's local part.
create or replace function public.admin_alert_digest(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with real_users as (
    select u.id, u.created_at, coalesce(nullif(split_part(p.display_name, ' ', 1), ''), split_part(u.email, '@', 1)) as who
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where coalesce(u.email, '') not like 'e2e-%' and coalesce(u.email, '') not like '%@fitlens.demo'
  ),
  signups as (
    select who from real_users where created_at > p_since order by created_at
  ),
  first_meals as (
    select r.who
    from public.meals m
    join real_users r on r.id = m.user_id
    where m.status = 'confirmed' and m.confirmed_at > p_since
      and not exists (select 1 from public.meals o where o.user_id = m.user_id and o.status = 'confirmed' and o.confirmed_at <= p_since)
    group by r.who
  ),
  errs as (
    select count(*) as n from public.client_events e where e.kind = 'error' and e.created_at > p_since
  )
  select jsonb_build_object(
    'signups', coalesce((select jsonb_agg(who) from signups), '[]'::jsonb),
    'first_meals', coalesce((select jsonb_agg(who) from first_meals), '[]'::jsonb),
    'errors', (select n from errs)
  );
$$;
revoke all on function public.admin_alert_digest(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_alert_digest(timestamptz) to service_role;
