-- ============================================================
-- Office Logging — Supabase setup
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

-- 1. Logs table -------------------------------------------------
create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null check (type in ('login', 'logout', 'break')),
  role       text not null check (role in ('staff', 'intern', 'guest', 'client', 'admin')),
  image_url  text not null,
  created_at timestamptz not null default now()
);

create index if not exists logs_created_at_idx on public.logs (created_at desc);

-- 2. Admin Activity Logs table -----------------------------------
create table if not exists public.admin_activity_logs (
  id         uuid primary key default gen_random_uuid(),
  action     text not null,
  details    text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_logs_created_at_idx on public.admin_activity_logs (created_at desc);

-- 2b. User state tracking ---------------------------------------
-- Tracks whether a person is currently in office, out of office, or on break.
-- The `state` column is set on each log entry to record the resulting state.

-- Recreate user_state enum with clearer names
alter table public.logs alter column state type text;
drop type if exists user_state;
create type user_state as enum ('in_office', 'out_of_office', 'on_break');
alter table public.logs alter column state type user_state
  using (
    case state::text
      when 'present' then 'in_office'::user_state
      when 'absent' then 'out_of_office'::user_state
      when 'on_break' then 'on_break'::user_state
      else 'out_of_office'::user_state
    end
  );
alter table public.logs alter column state set default 'out_of_office';

create index if not exists logs_name_created_at_idx on public.logs (name, created_at desc);

-- Dedicated users table (source of truth for current state)
create table if not exists public.users (
  name       text primary key,
  role       text not null check (role in ('staff', 'intern', 'guest', 'client', 'admin')),
  state      user_state not null default 'out_of_office',
  updated_at timestamptz not null default now()
);

-- RPC to read a user's current state (bypasses RLS via SECURITY DEFINER)
create or replace function get_user_state(p_name text)
returns user_state
language sql
security definer
stable
as $$
  select state
  from public.users
  where lower(name) = lower(btrim(p_name))
  limit 1;
$$;

grant execute on function get_user_state(text) to anon, authenticated;

-- RPC to read a user's role and state for kiosk-side role verification.
create or replace function get_user_profile(p_name text)
returns table(name text, role text, state user_state)
language sql
security definer
stable
as $$
  select u.name, u.role, u.state
  from public.users u
  where lower(u.name) = lower(btrim(p_name))
  limit 1;
$$;

grant execute on function get_user_profile(text) to anon, authenticated;

-- RPC to read the kiosk autocomplete directory without exposing full user rows.
create or replace function get_user_suggestions()
returns table(name text, role text)
language sql
security definer
stable
as $$
  select u.name, u.role
  from public.users u
  order by lower(u.name);
$$;

grant execute on function get_user_suggestions() to anon, authenticated;

-- RPC to upsert a user's state when a log is created
create or replace function upsert_user_state(p_name text, p_role text, p_state user_state)
returns void
language sql
security definer
as $$
  insert into public.users (name, role, state, updated_at)
  values (p_name, p_role, p_state, now())
  on conflict (name)
  do update set state = p_state, role = p_role, updated_at = now();
$$;

grant execute on function upsert_user_state(text, text, user_state) to anon, authenticated;

-- 3. Row Level Security ----------------------------------------
-- The kiosk inserts anonymously (anon key), but reading logs is
-- restricted to authenticated admins only.
alter table public.logs enable row level security;

create policy "Anyone can insert logs"
  on public.logs for insert
  to anon, authenticated
  with check (true);

create policy "Admins can read logs"
  on public.logs for select
  to authenticated
  using (true);

-- Users table RLS
alter table public.users enable row level security;

create policy "Anyone can upsert users"
  on public.users for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can update users"
  on public.users for update
  to anon, authenticated
  using (true);

create policy "Admins can read users"
  on public.users for select
  to authenticated
  using (true);

-- Activity logs RLS
alter table public.admin_activity_logs enable row level security;

create policy "Anyone can insert activity logs"
  on public.admin_activity_logs for insert
  to anon, authenticated
  with check (true);

create policy "Admins can read activity logs"
  on public.admin_activity_logs for select
  to authenticated
  using (true);

-- 4. Storage bucket for photos ---------------------------------
insert into storage.buckets (id, name, public)
values ('log-images', 'log-images', true)
on conflict (id) do nothing;

-- Allow public uploads + reads to the log-images bucket.
create policy "Anyone can upload log images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'log-images');

create policy "Anyone can read log images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'log-images');
