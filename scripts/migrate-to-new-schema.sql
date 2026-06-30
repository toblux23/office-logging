-- ============================================================
-- Migration: old logs schema → new schema
-- Run this on a database that was created with
-- supabase-setup-old.sql.  This is the ONLY script needed;
-- do NOT run supabase-setup.sql afterwards.
-- ============================================================

-- 0. Drop all existing policies so we can recreate them ----
drop policy if exists "Anyone can insert logs"       on public.logs;
drop policy if exists "Admins can read logs"         on public.logs;

drop policy if exists "Anyone can upsert users"      on public.users;
drop policy if exists "Anyone can update users"      on public.users;
drop policy if exists "Anyone can read users"        on public.users;

drop policy if exists "Anyone can insert activity logs"  on public.admin_activity_logs;
drop policy if exists "Admins can read activity logs"    on public.admin_activity_logs;

drop policy if exists "Authenticated users can read admin_config" on public.admin_config;
drop policy if exists "Admins can insert admin_config"             on public.admin_config;
drop policy if exists "Admins can delete admin_config"             on public.admin_config;

drop policy if exists "Anyone can upload log images" on storage.objects;
drop policy if exists "Anyone can read log images"   on storage.objects;

-- 1. Add new columns to existing logs table -----------------
alter table if exists public.logs
  add column if not exists role  text
    check (role in ('staff', 'intern', 'guest', 'client'));

alter table if exists public.logs
  add column if not exists state text
    check (state in ('in_office', 'out_of_office', 'on_break'));

-- 2. Backfill existing rows ----------------------------------
update public.logs set role = 'staff' where role is null;

update public.logs set state = 'in_office'    where type = 'login'  and state is null;
update public.logs set state = 'out_of_office' where type = 'logout' and state is null;
update public.logs set state = 'on_break'     where type = 'break'  and state is null;

-- 3. Make the new columns NOT NULL ---------------------------
alter table if exists public.logs
  alter column role  set not null,
  alter column state set not null;

-- 4. Add new index -------------------------------------------
create index if not exists logs_name_created_at_idx
  on public.logs (name, created_at desc);

-- 5. Create new tables ---------------------------------------
create table if not exists public.users (
  name       text primary key,
  role       text not null check (role in ('staff', 'intern', 'guest', 'client')),
  state      text not null default 'out_of_office'
               check (state in ('in_office', 'out_of_office', 'on_break')),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_activity_logs (
  id         uuid primary key default gen_random_uuid(),
  action     text not null,
  details    text not null,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_logs_created_at_idx
  on public.admin_activity_logs (created_at desc);

create table if not exists public.admin_config (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- 6. Seed users from existing log names ----------------------
insert into public.users (name, role, state)
select distinct name, 'staff', 'out_of_office'
from public.logs
on conflict (name) do nothing;

-- 7. Row Level Security --------------------------------------

-- Logs
alter table public.logs enable row level security;

create policy "Anyone can insert logs"
  on public.logs for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read logs"
  on public.logs for select
  to anon, authenticated
  using (true);

-- Users
alter table public.users enable row level security;

create policy "Anyone can upsert users"
  on public.users for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can update users"
  on public.users for update
  to anon, authenticated
  using (true);

create policy "Anyone can read users"
  on public.users for select
  to anon, authenticated
  using (true);

-- Admin activity logs
alter table public.admin_activity_logs enable row level security;

create policy "Anyone can insert activity logs"
  on public.admin_activity_logs for insert
  to anon, authenticated
  with check (true);

create policy "Admins can read activity logs"
  on public.admin_activity_logs for select
  to authenticated
  using (true);

-- Admin config
alter table public.admin_config enable row level security;

create policy "Authenticated users can read admin_config"
  on public.admin_config for select
  to authenticated
  using (true);

create policy "Admins can insert admin_config"
  on public.admin_config for insert
  to authenticated
  with check (exists (select 1 from public.admin_config where email = auth.jwt() ->> 'email'));

create policy "Admins can delete admin_config"
  on public.admin_config for delete
  to authenticated
  using (
    exists (select 1 from public.admin_config where email = auth.jwt() ->> 'email')
    and email <> auth.jwt() ->> 'email'
  );

-- 8. Storage bucket for photos --------------------------------
insert into storage.buckets (id, name, public)
values ('log-images', 'log-images', true)
on conflict (id) do nothing;

create policy "Anyone can upload log images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'log-images');

create policy "Anyone can read log images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'log-images');
