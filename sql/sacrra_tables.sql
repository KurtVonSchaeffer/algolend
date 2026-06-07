-- =====================================================================
-- SACRRA Supporting Tables
-- Run once in Supabase SQL Editor (safe to re-run)
-- =====================================================================

-- Patch existing table if it already exists without these columns
alter table if exists public.sacrra_submissions
  add column if not exists status         text not null default 'PENDING',
  add column if not exists submission_type text not null default 'MONTHLY',
  add column if not exists record_count   integer not null default 0,
  add column if not exists notes          text null,
  add column if not exists updated_at     timestamptz not null default now();

alter table if exists public.sacrra_rejections
  add column if not exists resolved      boolean not null default false,
  add column if not exists resolved_at   timestamptz null,
  add column if not exists resolved_by   text null,
  add column if not exists submission_id bigint null,
  add column if not exists updated_at    timestamptz not null default now();

-- Submission history: one row per file generated & downloaded
create table if not exists public.sacrra_submissions (
  id            bigserial primary key,
  file_name     text not null,
  submission_type text not null default 'MONTHLY',   -- MONTHLY | DAILY
  record_count  integer not null default 0,
  status        text not null default 'PENDING',     -- PENDING | ACCEPTED | REJECTED
  notes         text null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists sacrra_submissions_created_at_idx
  on public.sacrra_submissions (created_at desc);

create index if not exists sacrra_submissions_status_idx
  on public.sacrra_submissions (status);

-- Bureau rejection feed: populated by uploading the bureau's .TXT feedback file
create table if not exists public.sacrra_rejections (
  id            bigserial primary key,
  match_key     text not null,          -- SRN (6) + account number — bureau's reference
  error_code    text not null,          -- e.g. E01, E14
  error_message text null,
  resolved      boolean not null default false,
  resolved_at   timestamptz null,
  resolved_by   text null,
  submission_id bigint null references public.sacrra_submissions(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists sacrra_rejections_match_key_idx
  on public.sacrra_rejections (match_key);

create index if not exists sacrra_rejections_resolved_idx
  on public.sacrra_rejections (resolved);

-- Auto-update updated_at on sacrra_submissions
create or replace function public.set_sacrra_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sacrra_submissions_updated_at on public.sacrra_submissions;
create trigger sacrra_submissions_updated_at
  before update on public.sacrra_submissions
  for each row execute function public.set_sacrra_updated_at();

drop trigger if exists sacrra_rejections_updated_at on public.sacrra_rejections;
create trigger sacrra_rejections_updated_at
  before update on public.sacrra_rejections
  for each row execute function public.set_sacrra_updated_at();

-- RLS: admin-only access
alter table public.sacrra_submissions enable row level security;
alter table public.sacrra_rejections  enable row level security;

-- Allow service role full access (used by server-side operations)
create policy "service_role_sacrra_submissions" on public.sacrra_submissions
  for all using (true) with check (true);

create policy "service_role_sacrra_rejections" on public.sacrra_rejections
  for all using (true) with check (true);
