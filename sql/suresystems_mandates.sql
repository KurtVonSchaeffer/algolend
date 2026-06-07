-- SureSystems mandate activation audit table
-- Run this in Supabase SQL editor before using DB-backed activation tracking.

create table if not exists public.suresystems_mandates (
  id bigserial primary key,
  application_id bigint not null,
  user_id uuid null,
  status text not null default 'unknown',
  contract_reference text null,
  message text null,
  request_payload jsonb null,
  response_payload jsonb null,
  error_payload jsonb null,
  activated_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suresystems_mandates_application_id_uidx
  on public.suresystems_mandates (application_id);

create index if not exists suresystems_mandates_contract_reference_idx
  on public.suresystems_mandates (contract_reference);

create index if not exists suresystems_mandates_status_idx
  on public.suresystems_mandates (status);

create index if not exists suresystems_mandates_updated_at_idx
  on public.suresystems_mandates (updated_at desc);

-- Optional FK guards (kept nullable-friendly)
do $$
begin
  begin
    alter table public.suresystems_mandates
      add constraint suresystems_mandates_application_fk
      foreign key (application_id)
      references public.loan_applications(id)
      on delete cascade;
  exception when duplicate_object then
    null;
  end;

  begin
    alter table public.suresystems_mandates
      add constraint suresystems_mandates_user_fk
      foreign key (user_id)
      references auth.users(id)
      on delete set null;
  exception when duplicate_object then
    null;
  end;
end $$;

-- Keep updated_at fresh on updates
create or replace function public.touch_suresystems_mandates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_suresystems_mandates_updated_at on public.suresystems_mandates;
create trigger trg_touch_suresystems_mandates_updated_at
before update on public.suresystems_mandates
for each row
execute function public.touch_suresystems_mandates_updated_at();

-- If RLS is enabled in your project and you need dashboard reads with anon/authenticated,
-- add policies as needed. Server-side service role bypasses RLS by default.
