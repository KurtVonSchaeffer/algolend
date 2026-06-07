-- =====================================================================
-- api_usage_log — centralised external-API call audit for billing
-- Run once in Supabase SQL Editor.
-- =====================================================================
-- Every call to Experian, TruID, DocuSeal, or SureSystems writes a row
-- here. client_id comes from the CLIENT_ID env var set per deployment,
-- so billing reports can aggregate by tenant.
-- =====================================================================

create table if not exists public.api_usage_log (
  id               bigserial        primary key,
  client_id        text             not null default 'default',
  service          text             not null,   -- 'experian' | 'truid' | 'docuseal' | 'suresystems'
  operation        text             not null,   -- e.g. 'credit_check', 'initiate_collection', 'send_contract', 'load_mandate'
  application_id   text,
  user_id          uuid,
  status           text             not null,   -- 'success' | 'error' | 'timeout'
  http_status      integer,
  latency_ms       integer,
  error_message    text,
  metadata         jsonb,
  created_at       timestamptz      not null default now()
);

-- Indexes that matter for billing queries
create index if not exists idx_api_usage_client_month
  on public.api_usage_log (client_id, created_at desc);

create index if not exists idx_api_usage_service
  on public.api_usage_log (service, created_at desc);

create index if not exists idx_api_usage_application
  on public.api_usage_log (application_id) where application_id is not null;

-- RLS: service role writes, authenticated admins read own client
alter table public.api_usage_log enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'api_usage_log'
    and policyname = 'service role full access on api_usage_log'
  ) then
    create policy "service role full access on api_usage_log"
      on public.api_usage_log for all to service_role
      using (true) with check (true);
  end if;
end $$;

-- Monthly rollup view — used by mint-admin billing engine
create or replace view public.api_usage_monthly as
select
  client_id,
  service,
  operation,
  date_trunc('month', created_at) as month,
  count(*)                         as total_calls,
  count(*) filter (where status = 'success') as successful_calls,
  count(*) filter (where status = 'error')   as failed_calls,
  round(avg(latency_ms))           as avg_latency_ms
from public.api_usage_log
group by client_id, service, operation, date_trunc('month', created_at);
