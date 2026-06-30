-- ============================================================
-- Migration: old logs schema → new schema
-- Run this BEFORE supabase-setup.sql on an existing database
-- that was created with supabase-setup-old.sql.
-- ============================================================

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

-- 4. Update the old read policy on logs ----------------------
-- Old script created "Admins can read logs" (authenticated only).
-- New script creates "Anyone can read logs" (anon + authenticated).
-- Drop the old one so supabase-setup.sql can create its own.
drop policy if exists "Admins can read logs" on public.logs;

-- The insert policy and RLS enable are the same in both scripts,
-- so we leave them alone.

-- 5. Create tables that supabase-setup.sql expects -----------
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

create table if not exists public.admin_config (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- 6. Seed users from existing log names ----------------------
insert into public.users (name, role, state)
select distinct name, 'staff', 'out_of_office'
from public.logs
on conflict (name) do nothing;
