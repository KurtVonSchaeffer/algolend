-- TruID bank snapshot table for normalized metrics + raw payload retention.
-- Run this in Supabase SQL editor.

create table if not exists public.truid_bank_snapshots (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  collection_id text not null,
  bank_name text null,
  customer_name text null,
  captured_at timestamptz not null default now(),
  months_captured integer not null default 0,
  total_income numeric(14, 2) not null default 0,
  total_expenses numeric(14, 2) not null default 0,
  avg_monthly_income numeric(14, 2) not null default 0,
  avg_monthly_expenses numeric(14, 2) not null default 0,
  net_monthly_income numeric(14, 2) not null default 0,
  main_salary numeric(14, 2) not null default 0,
  salary_payment_date timestamptz null,
  summary_data jsonb null,
  raw_statement jsonb null,
  constraint truid_bank_snapshots_pkey primary key (id),
  constraint truid_bank_snapshots_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade
);

create index if not exists truid_bank_snapshots_user_id_idx
  on public.truid_bank_snapshots using btree (user_id);

create index if not exists truid_bank_snapshots_collection_id_idx
  on public.truid_bank_snapshots using btree (collection_id);

-- Needed for reliable upserts by collection_id in backend code.
create unique index if not exists truid_bank_snapshots_collection_id_unique_idx
  on public.truid_bank_snapshots using btree (collection_id);

create index if not exists truid_bank_snapshots_salary_payment_date_idx
  on public.truid_bank_snapshots using btree (salary_payment_date);

create index if not exists truid_bank_snapshots_summary_data_gin_idx
  on public.truid_bank_snapshots using gin (summary_data);

create index if not exists truid_bank_snapshots_raw_statement_gin_idx
  on public.truid_bank_snapshots using gin (raw_statement);

-- Optional RLS policy for backend service role.
alter table public.truid_bank_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'truid_bank_snapshots'
      and policyname = 'service role full access on truid_bank_snapshots'
  ) then
    create policy "service role full access on truid_bank_snapshots"
      on public.truid_bank_snapshots
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;
