-- ============================================================
-- Migration: old logs schema → new schema
-- Run this on a database that was created with supabase-setup-old.sql.
-- ============================================================

-- Helper: safely check existence of tables via to_regclass
-- (No CREATE FUNCTION needed; we use DO blocks.)

-- 0) Drop all existing policies (only if target tables exist) ----
DO $$
BEGIN
  -- logs
  IF to_regclass('public.logs') IS NOT NULL THEN
    EXECUTE 'drop policy if exists "Anyone can insert logs" on public.logs';
    EXECUTE 'drop policy if exists "Admins can read logs" on public.logs';
  END IF;

  -- users
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'drop policy if exists "Anyone can upsert users" on public.users';
    EXECUTE 'drop policy if exists "Anyone can update users" on public.users';
    EXECUTE 'drop policy if exists "Anyone can read users" on public.users';
  END IF;

  -- admin activity logs
  IF to_regclass('public.admin_activity_logs') IS NOT NULL THEN
    EXECUTE 'drop policy if exists "Anyone can insert activity logs" on public.admin_activity_logs';
    EXECUTE 'drop policy if exists "Admins can read activity logs" on public.admin_activity_logs';
  END IF;

  -- admin config
  IF to_regclass('public.admin_config') IS NOT NULL THEN
    EXECUTE 'drop policy if exists "Authenticated users can read admin_config" on public.admin_config';
    EXECUTE 'drop policy if exists "Admins can insert admin_config" on public.admin_config';
    EXECUTE 'drop policy if exists "Admins can delete admin_config" on public.admin_config';
  END IF;

  -- storage objects
  -- storage.objects is expected to exist, but we still guard.
  IF to_regclass('storage.objects') IS NOT NULL THEN
    EXECUTE 'drop policy if exists "Anyone can upload log images" on storage.objects';
    EXECUTE 'drop policy if exists "Anyone can read log images" on storage.objects';
  END IF;
END $$;

-- 1) Add new columns to existing logs table (if logs exists) ----
DO $$
BEGIN
  IF to_regclass('public.logs') IS NOT NULL THEN

    ALTER TABLE public.logs
      ADD COLUMN IF NOT EXISTS role text
        CHECK (role IN ('staff', 'intern', 'guest', 'client'));

    ALTER TABLE public.logs
      ADD COLUMN IF NOT EXISTS state text
        CHECK (state IN ('in_office', 'out_of_office', 'on_break'));

    -- 2) Backfill existing rows ----------------------------------
    -- Only update rows where columns exist and are NULL-ish.
    -- (If columns were just added, they will be NULL for existing rows.)

    UPDATE public.logs
    SET role = 'staff'
    WHERE role IS NULL;

    -- These depend on existing columns: type and state.
    -- If type column doesn't exist, this will error.
    -- If you need this to be fully defensive, tell me what old schema you have.
    UPDATE public.logs
    SET state = 'in_office'
    WHERE type = 'login' AND state IS NULL;

    UPDATE public.logs
    SET state = 'out_of_office'
    WHERE type = 'logout' AND state IS NULL;

    UPDATE public.logs
    SET state = 'on_break'
    WHERE type = 'break' AND state IS NULL;

    -- 3) Make the new columns NOT NULL ---------------------------
    ALTER TABLE public.logs
      ALTER COLUMN role SET NOT NULL,
      ALTER COLUMN state SET NOT NULL;

    -- 4) Add new index --------------------------------------------
    CREATE INDEX IF NOT EXISTS logs_name_created_at_idx
      ON public.logs (name, created_at DESC);

  END IF;
END $$;

-- 5) Create new tables ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  name       text PRIMARY KEY,
  role       text NOT NULL
               CHECK (role IN ('staff', 'intern', 'guest', 'client')),
  state      text NOT NULL DEFAULT 'out_of_office'
               CHECK (state IN ('in_office', 'out_of_office', 'on_break')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action     text NOT NULL,
  details    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_activity_logs_created_at_idx
  ON public.admin_activity_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_config (
  email      text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) Seed users from existing log names ---------------------------
DO $$
BEGIN
  IF to_regclass('public.logs') IS NOT NULL AND to_regclass('public.users') IS NOT NULL THEN
    INSERT INTO public.users (name, role, state)
    SELECT DISTINCT name, 'staff', 'out_of_office'
    FROM public.logs
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

-- 7) Row Level Security ---------------------------------------------

-- Logs
DO $$
BEGIN
  IF to_regclass('public.logs') IS NOT NULL THEN
    ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

    -- “Anyone” policies as in your original script
    CREATE POLICY "Anyone can insert logs"
      ON public.logs FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);

    CREATE POLICY "Anyone can read logs"
      ON public.logs FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can upsert users"
  ON public.users FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update users"
  ON public.users FOR UPDATE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can read users"
  ON public.users FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin activity logs
ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert activity logs"
  ON public.admin_activity_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read activity logs"
  ON public.admin_activity_logs FOR SELECT
  TO authenticated
  USING (true);

-- Admin config
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read admin_config"
  ON public.admin_config FOR SELECT
  TO authenticated
  USING (true);

-- NOTE: Your original “Admins can insert/admin_config” logic checks whether
-- the inserting user's email already exists in admin_config.
-- That means you can’t add the *first* admin unless it already exists.

CREATE POLICY "Admins can insert admin_config"
  ON public.admin_config FOR INSERT
  TO authenticated
  WITH CHECK (exists (
    select 1
    from public.admin_config
    where email = auth.jwt() ->> 'email'
  ));

CREATE POLICY "Admins can delete admin_config"
  ON public.admin_config FOR DELETE
  TO authenticated
  USING (
    exists (
      select 1
      from public.admin_config
      where email = auth.jwt() ->> 'email'
    )
    AND email <> auth.jwt() ->> 'email'
  );

-- 8) Storage bucket for photos ---------------------------------------
DO $$
BEGIN
  -- buckets table should exist; guard anyway
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('log-images', 'log-images', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Ensure storage policies only if storage.objects exists
DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    CREATE POLICY "Anyone can upload log images"
      ON storage.objects FOR INSERT
      TO anon, authenticated
      WITH CHECK (bucket_id = 'log-images');

    CREATE POLICY "Anyone can read log images"
      ON storage.objects FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'log-images');
  END IF;
END $$;