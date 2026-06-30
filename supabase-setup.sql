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

alter table public.logs enable row level security;

create policy "Anyone can insert logs"
  on public.logs for insert
  to anon, authenticated
  with check (true);

create policy "Anyone can read logs"
  on public.logs for select
  to anon, authenticated
  using (true);

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

alter table public.admin_activity_logs enable row level security;

create policy "Anyone can insert activity logs"
  on public.admin_activity_logs for insert
  to anon, authenticated
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

-- 5. Storage bucket for photos --------------------------------
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
