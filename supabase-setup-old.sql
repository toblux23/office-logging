-- ============================================================
-- Office Logging — Supabase setup
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor).
-- ============================================================

-- 1. Logs table -------------------------------------------------
create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null check (type in ('login', 'logout', 'break')),
  image_url  text not null,
  created_at timestamptz not null default now()
);

create index if not exists logs_created_at_idx on public.logs (created_at desc);

-- 2. Row Level Security ----------------------------------------
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

-- 3. Storage bucket for photos ---------------------------------
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