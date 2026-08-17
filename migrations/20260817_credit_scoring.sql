-- Migration: AI credit scoring tables
-- credit_features: raw Gemini extraction per bank statement document
-- credit_scores:   scorecard result per application
-- credit_outcomes: final adjudication decision (automated or manual override)
--
-- All three tables:
--   - user_id / application_id are uuid (loan_applications.id is uuid)
--   - Service role has full access (scoring runs server-side)
--   - Authenticated users can read their own rows (portal may surface score summary)
--   - RLS enabled

-- ── credit_features ────────────────────────────────────────────────────────────

create table if not exists public.credit_features (
  id                         uuid        not null default gen_random_uuid() primary key,
  user_id                    uuid        not null references auth.users(id) on delete cascade,
  application_id             uuid        null     references public.loan_applications(id) on delete set null,
  document_id                uuid        null     references public.document_uploads(id) on delete set null,

  -- Gemini extraction outputs
  months_of_data             integer     not null default 0,
  gross_income               numeric(12,2) not null default 0,
  net_income                 numeric(12,2) not null default 0,
  avg_monthly_deposits       numeric(12,2) not null default 0,
  min_monthly_deposits       numeric(12,2) not null default 0,
  avg_closing_balance        numeric(12,2) not null default 0,
  min_closing_balance        numeric(12,2) not null default 0,
  existing_debt_installments numeric(12,2) not null default 0,
  num_lenders                integer     not null default 0,
  dishonored_debits          integer     not null default 0,
  salary_regularity          smallint    not null default 0,  -- 0 or 1
  gambling_detected          smallint    not null default 0,  -- 0 or 1
  large_irregular_credits    smallint    not null default 0,  -- 0 or 1

  raw_gemini_response        text        null,   -- full JSON text from Gemini (audit/debug)
  model_version              text        not null default '1.0.0',
  extracted_at               timestamptz not null default now()
);

create index if not exists idx_credit_features_user_id
  on public.credit_features (user_id, extracted_at desc);
create index if not exists idx_credit_features_application_id
  on public.credit_features (application_id) where application_id is not null;
create index if not exists idx_credit_features_document_id
  on public.credit_features (document_id) where document_id is not null;

alter table public.credit_features enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='credit_features'
    and policyname='service role full access on credit_features') then
    create policy "service role full access on credit_features"
      on public.credit_features for all to service_role using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='credit_features'
    and policyname='authenticated can read own credit_features') then
    create policy "authenticated can read own credit_features"
      on public.credit_features for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ── credit_scores ──────────────────────────────────────────────────────────────

create table if not exists public.credit_scores (
  id                   uuid        not null default gen_random_uuid() primary key,
  user_id              uuid        not null references auth.users(id) on delete cascade,
  application_id       uuid        null     references public.loan_applications(id) on delete set null,
  feature_id           uuid        null     references public.credit_features(id) on delete set null,

  score                integer     not null,         -- 0-850
  band                 text        not null,         -- POOR/BELOW_AVERAGE/AVERAGE/FAIR/GOOD/EXCELLENT
  recommendation       text        not null,         -- approve/review/decline
  adverse_action_codes text[]      not null default '{}',

  -- Sub-scores (for explainability and audit)
  income_stability_score  integer  not null default 0,
  debt_ratio_score        integer  not null default 0,
  balance_behaviour_score integer  not null default 0,
  credit_behaviour_score  integer  not null default 0,
  lender_load_score       integer  not null default 0,

  dti_ratio            numeric(6,4) null,            -- debt-to-income ratio
  available_income     numeric(12,2) null,           -- net income minus existing debts
  model_version        text        not null default '1.0.0',
  scored_at            timestamptz not null default now()
);

create index if not exists idx_credit_scores_application_id
  on public.credit_scores (application_id, scored_at desc) where application_id is not null;
create index if not exists idx_credit_scores_user_id
  on public.credit_scores (user_id, scored_at desc);

alter table public.credit_scores enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='credit_scores'
    and policyname='service role full access on credit_scores') then
    create policy "service role full access on credit_scores"
      on public.credit_scores for all to service_role using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='credit_scores'
    and policyname='authenticated can read own credit_scores') then
    create policy "authenticated can read own credit_scores"
      on public.credit_scores for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- ── credit_outcomes ────────────────────────────────────────────────────────────

create table if not exists public.credit_outcomes (
  id                   uuid        not null default gen_random_uuid() primary key,
  user_id              uuid        not null references auth.users(id) on delete cascade,
  application_id       uuid        null     references public.loan_applications(id) on delete set null,
  score_id             uuid        null     references public.credit_scores(id) on delete set null,

  outcome              text        not null,         -- approved/declined/review/overridden
  adverse_action_codes text[]      not null default '{}',
  decided_at           timestamptz not null default now(),
  decided_by           uuid        null,             -- null = automated; uuid = admin who overrode
  notes                text        null
);

create index if not exists idx_credit_outcomes_application_id
  on public.credit_outcomes (application_id, decided_at desc) where application_id is not null;
create index if not exists idx_credit_outcomes_user_id
  on public.credit_outcomes (user_id, decided_at desc);

alter table public.credit_outcomes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='credit_outcomes'
    and policyname='service role full access on credit_outcomes') then
    create policy "service role full access on credit_outcomes"
      on public.credit_outcomes for all to service_role using (true) with check (true);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='credit_outcomes'
    and policyname='authenticated can read own credit_outcomes') then
    create policy "authenticated can read own credit_outcomes"
      on public.credit_outcomes for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
