-- Allow authenticated users to read their own profile row.
-- Run this in Supabase SQL Editor.

-- Enable RLS if not already on
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop if exists to avoid duplicate
DROP POLICY IF EXISTS "users can read own profile" ON public.profiles;

CREATE POLICY "users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "users can update own profile" ON public.profiles;

CREATE POLICY "users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);
