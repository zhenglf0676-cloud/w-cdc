-- W-CDC schema derived from the routes and the typed source export.
-- Restore auth.users first, then copy the staged business rows in dependency order.
-- This migration contains no credentials or exported customer data.

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'enterprise' check (role in ('enterprise', 'admin')),
  full_name text,
  company_name text,
  park_name text,
  latitude numeric(10, 7) check (latitude between -90 and 90),
  longitude numeric(10, 7) check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.discharge_outlets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  park_name text,
  name text not null,
  latitude numeric(10, 7) check (latitude between -90 and 90),
  longitude numeric(10, 7) check (longitude between -180 and 180),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table public.pollutant_applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.profiles(id) on delete cascade,
  pollutants jsonb not null default '[]'::jsonb check (jsonb_typeof(pollutants) = 'array'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.monitoring_data (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.discharge_outlets(id) on delete cascade,
  pollutant_type text not null,
  value numeric(18, 8) not null,
  unit text not null,
  standard_limit numeric(18, 8),
  status text not null default 'normal' check (status in ('normal', 'warning')),
  monitored_at timestamptz not null,
  remark text,
  created_at timestamptz not null default now()
);

-- Historical name: notifications.user_id stores a profiles.id, not an auth.users.id.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index profiles_role_park_idx on public.profiles (role, park_name);
create index outlets_user_status_idx on public.discharge_outlets (user_id, status);
create index outlets_park_status_idx on public.discharge_outlets (park_name, status);
create index applications_company_status_idx on public.pollutant_applications (company_id, status, created_at desc);
create index monitoring_outlet_time_idx on public.monitoring_data (outlet_id, monitored_at desc);
create index monitoring_outlet_pollutant_time_idx on public.monitoring_data (outlet_id, pollutant_type, monitored_at desc);
create index notifications_profile_time_idx on public.notifications (user_id, created_at desc);

-- Private helpers avoid recursive profiles RLS lookups. They derive the caller from
-- auth.uid() and do not accept a user ID or a role supplied by a client.
create function app_private.is_park_admin(requested_park text)
returns boolean language sql stable security definer set search_path = '' as $$
  select requested_park is not null and exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role = 'admin' and p.park_name = requested_park
  );
$$;

create function app_private.can_read_company(requested_company uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = requested_company
      and (p.user_id = (select auth.uid()) or app_private.is_park_admin(p.park_name))
  );
$$;

create function app_private.can_read_outlet(requested_outlet uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.discharge_outlets o
    where o.id = requested_outlet
      and (o.user_id = (select auth.uid()) or app_private.is_park_admin(o.park_name))
  );
$$;

revoke all on function app_private.is_park_admin(text) from public, anon;
revoke all on function app_private.can_read_company(uuid) from public, anon;
revoke all on function app_private.can_read_outlet(uuid) from public, anon;
grant execute on function app_private.is_park_admin(text),
  app_private.can_read_company(uuid), app_private.can_read_outlet(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.discharge_outlets enable row level security;
alter table public.pollutant_applications enable row level security;
alter table public.monitoring_data enable row level security;
alter table public.notifications enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or app_private.is_park_admin(park_name));
create policy profiles_self_signup on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'enterprise');
create policy outlets_read on public.discharge_outlets for select to authenticated
  using (user_id = (select auth.uid()) or app_private.is_park_admin(park_name));
create policy applications_read on public.pollutant_applications for select to authenticated
  using (app_private.can_read_company(company_id));
create policy monitoring_read on public.monitoring_data for select to authenticated
  using (app_private.can_read_outlet(outlet_id));
create policy notifications_read on public.notifications for select to authenticated
  using (app_private.can_read_company(user_id));

-- Business writes go through server endpoints after authenticating and checking
-- the actor. The browser only writes its own enterprise profile at sign-up.
revoke all on public.profiles, public.discharge_outlets,
  public.pollutant_applications, public.monitoring_data,
  public.notifications from anon, authenticated;
grant select on public.profiles, public.discharge_outlets,
  public.pollutant_applications, public.monitoring_data,
  public.notifications to authenticated;
grant insert on public.profiles to authenticated;
