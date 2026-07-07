-- ============================================================
-- Office Logging — Development Supabase setup
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

-- 1. Logs table ----------------------------------------------
create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null check (type in ('login', 'logout', 'break')),
  role       text not null check (role in ('staff', 'intern', 'guest', 'client')),
  state      text not null default 'out_of_office'
               check (state in ('in_office', 'out_of_office', 'on_break')),
  image_url  text not null,
  created_at timestamptz not null default now()
);

create index if not exists logs_created_at_idx on public.logs (created_at desc);
create index if not exists logs_name_created_at_idx on public.logs (name, created_at desc);

-- 2. Admin Activity Logs table --------------------------------
create table if not exists public.admin_activity_logs (
  id         uuid primary key default gen_random_uuid(),
  action     text not null,
  details    text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_logs_created_at_idx on public.admin_activity_logs (created_at desc);

-- 3. Users table ----------------------------------------------
create table if not exists public.users (
  name       text primary key,
  role       text not null check (role in ('staff', 'intern', 'guest', 'client')),
  state      text not null default 'out_of_office'
               check (state in ('in_office', 'out_of_office', 'on_break')),
  updated_at timestamptz not null default now()
);

-- 4. Row Level Security --------------------------------------

-- Logs: kiosk can INSERT (anonymous), only admins can SELECT
alter table public.logs enable row level security;

create policy "Anyone can insert logs"
  on public.logs for insert
  to anon, authenticated
  with check (true);

create policy "Admins can read logs"
  on public.logs for select
  to authenticated
  using (true);

-- Users: only authenticated users can read / write
alter table public.users enable row level security;

create policy "Admins can upsert users"
  on public.users for insert
  to authenticated
  with check (true);

create policy "Admins can update users"
  on public.users for update
  to authenticated
  using (true);

create policy "Admins can read users"
  on public.users for select
  to authenticated
  using (true);

-- Admin activity logs: only authenticated users can write / read
alter table public.admin_activity_logs enable row level security;

create policy "Admins can insert activity logs"
  on public.admin_activity_logs for insert
  to authenticated
  with check (true);

create policy "Admins can read activity logs"
  on public.admin_activity_logs for select
  to authenticated
  using (true);

-- 6. Admin config table (stores all admin emails) ---------------------------
create table if not exists public.admin_config (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_config enable row level security;

-- Authenticated users can read (only email addresses, not secrets)
create policy "Authenticated users can read admin_config"
  on public.admin_config for select
  to authenticated
  using (true);

-- Existing admins can add new admins
create policy "Admins can insert admin_config"
  on public.admin_config for insert
  to authenticated
  with check (exists (select 1 from public.admin_config where email = auth.jwt() ->> 'email'));

-- Admins can remove other admins (but cannot remove themselves)
create policy "Admins can delete admin_config"
  on public.admin_config for delete
  to authenticated
  using (
    exists (select 1 from public.admin_config where email = auth.jwt() ->> 'email')
    and email <> auth.jwt() ->> 'email'
  );

-- 5. Grant permissions for service_role -----------------------
-- Required so API routes using SUPABASE_SERVICE_ROLE_KEY can access these tables.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- 6. Storage bucket for photos --------------------------------
insert into storage.buckets (id, name, public)
values ('log-images', 'log-images', true)
on conflict (id) do nothing;

-- Drop existing policies (so re-running the script works)
drop policy if exists "Anyone can upload log images" on storage.objects;
drop policy if exists "Anyone can read log images" on storage.objects;

-- Recreate policies
create policy "Anyone can upload log images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'log-images');

-- NOTE: No SELECT policy on storage.objects.
-- The bucket is public so existing photo URLs remain accessible,
-- but listing/filtering objects via the API requires authentication.
-- This prevents anonymous data scraping of all stored photos.
