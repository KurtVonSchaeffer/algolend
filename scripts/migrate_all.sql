-- AlgoLend Demo Schema
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create table if not exists admin_action_audit (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  action_category text not null,
  action_description text not null,
  affected_records jsonb,
  risk_level text,
  ip_address text,
  session_id text,
  approval_status text,
  reviewed_by uuid,
  review_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  message text not null,
  link text,
  target_role text not null,
  read_by jsonb,
  branch_id bigint
);

create table if not exists api_usage_log (
  id bigint generated always as identity primary key,
  client_id text not null,
  service text not null,
  operation text not null,
  application_id text,
  user_id uuid,
  status text not null,
  http_status integer,
  latency_ms integer,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  entity_type text not null,
  entity_id bigint not null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  changes_summary text,
  metadata jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bank_accounts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  bank_name text not null,
  account_holder text not null,
  account_number text not null,
  branch_code text not null,
  account_type text not null,
  is_primary boolean not null default false,
  is_verified boolean not null default false,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  created_by_admin uuid
);

create table if not exists branches (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  address text,
  region text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  type text
);

create table if not exists cash_journal (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  entry_type text not null,
  category text,
  description text not null,
  amount numeric not null,
  reference text,
  branch_id bigint,
  created_by uuid,
  created_by_name text,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  application_id bigint,
  report_reference text,
  report_date timestamptz,
  bureau_name text,
  first_name text,
  last_name text,
  id_number text,
  date_of_birth date,
  credit_score integer,
  score_band text,
  risk_category text,
  total_accounts integer,
  open_accounts integer,
  closed_accounts integer,
  total_balance numeric,
  total_monthly_payment numeric,
  total_credit_limit numeric,
  credit_utilization numeric,
  accounts_in_good_standing integer,
  accounts_with_arrears integer,
  accounts_in_default integer,
  total_arrears_amount numeric,
  total_enquiries integer,
  enquiries_last_3_months integer,
  enquiries_last_6_months integer,
  enquiries_last_12_months integer,
  total_judgments integer,
  total_judgment_amount numeric,
  raw_xml_data text,
  parsed_accounts jsonb,
  parsed_enquiries jsonb,
  parsed_judgments jsonb,
  risk_flags jsonb,
  recommendation text,
  recommendation_reason text,
  status text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ncr_reference text,
  reported_to_ncr boolean,
  reported_at timestamptz
);

create table if not exists credit_eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rule_key text not null,
  rule_label text not null,
  description text,
  operator text not null,
  threshold_value text,
  fail_action text not null,
  decline_reason text,
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_score_bands (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  label text not null,
  min_score integer not null,
  max_score integer not null,
  risk_level text not null,
  color text,
  max_loan_amount numeric not null,
  interest_rate_pa numeric not null,
  max_term_months integer,
  initiation_fee_pct numeric,
  monthly_service_fee numeric,
  auto_decision text,
  is_active boolean not null default true,
  sort_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_loan_max_term_months integer
);

create table if not exists declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  historically_disadvantaged boolean,
  accepted_std_conditions boolean,
  home_ownership text,
  marital_status text,
  highest_qualification text,
  referral_provided boolean,
  referral_name text,
  referral_phone text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  credit_check_consent_accepted boolean not null,
  credit_check_consent_accepted_at timestamptz,
  credit_check_consent_version text
);

create table if not exists document_uploads (
  id bigint generated always as identity primary key,
  file_name text not null,
  original_name text not null,
  file_path text not null,
  file_type text not null,
  mime_type text,
  file_size integer,
  user_id uuid,
  application_id bigint,
  status text,
  verified_by uuid,
  verified_at timestamptz,
  rejection_reason text,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id bigint generated always as identity primary key,
  application_id bigint not null,
  uploaded_by uuid not null,
  file_name text not null,
  storage_path text not null,
  file_type text,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists docuseal_submissions (
  id bigint generated always as identity primary key,
  application_id bigint,
  submission_id text not null,
  slug text not null,
  status text,
  template_id text,
  submitters jsonb,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  email text,
  embed_src text,
  name text,
  opened_at timestamptz,
  role text,
  submitter_id text,
  sent_at timestamptz,
  archived_at timestamptz,
  declined_at timestamptz
);

create table if not exists financial_profiles (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  monthly_income numeric,
  monthly_expenses numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disposable_income numeric,
  debt_to_income_ratio numeric,
  affordability_ratio numeric,
  parsed_data jsonb,
  max_loan_amount numeric
);

create table if not exists financial_transaction_log (
  id bigint generated always as identity primary key,
  loan_id bigint not null,
  transaction_type text not null,
  amount numeric not null,
  balance_before numeric,
  balance_after numeric,
  reference_number text,
  external_reference text,
  status text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists kyc_sessions (
  session_id text not null,
  user_id uuid not null,
  status text,
  session_token text,
  verification_url text,
  event_type text,
  created_at timestamptz not null default now(),
  last_updated timestamptz,
  first_name text,
  last_name text,
  id_number text,
  phone_number text,
  gender text,
  date_of_birth date,
  address text,
  city text,
  postal_code text,
  province text,
  country text,
  id_front_image_url text,
  id_back_image_url text,
  selfie_image_url text,
  extracted_data jsonb
);

create table if not exists loan_applications (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  created_by_admin uuid,
  reviewed_by_admin uuid,
  status text not null,
  amount numeric not null,
  term_months integer not null,
  purpose text,
  bureau_score_band text,
  contract_signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  bank_account_id bigint,
  offer_details jsonb,
  notes text,
  source text,
  offer_principal numeric,
  offer_interest_rate numeric,
  offer_total_interest numeric,
  offer_total_admin_fees numeric,
  offer_total_initiation_fees numeric,
  offer_monthly_repayment numeric,
  offer_total_repayment numeric,
  offer_credit_life_monthly numeric,
  repayment_start_date timestamptz,
  branch_id bigint,
  application_source text,
  is_walkin_claim boolean not null default false,
  has_credit_life_insurance boolean not null,
  offer_credit_life_total numeric not null,
  credit_life_contract_signed boolean not null,
  credit_life_signed_at timestamptz,
  credit_life_signature_data text,
  credit_life_contract_version text,
  credit_life_contract_file_name text,
  credit_life_contract_file_path text,
  offer_vat_amount numeric,
  offer_total_cost_of_credit numeric,
  credit_decision text,
  credit_band_label text,
  credit_band_color text,
  credit_max_loan numeric,
  credit_rate_pa numeric,
  credit_max_term integer,
  credit_decline_reasons jsonb,
  first_loan_restriction text,
  is_first_loan boolean not null default false,
  loan_purpose text,
  loan_number bigint not null,
  routed_to_head_office boolean,
  agreement_number text
);

create table if not exists loan_state_history (
  id bigint generated always as identity primary key,
  loan_id bigint not null,
  user_id uuid,
  previous_status text,
  new_status text not null,
  previous_balance numeric,
  new_balance numeric,
  previous_payment_date date,
  new_payment_date date,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists loans (
  id bigint generated always as identity primary key,
  application_id bigint not null,
  user_id uuid not null,
  principal_amount numeric not null,
  interest_rate numeric not null,
  term_months integer not null,
  status text not null,
  start_date timestamptz,
  next_payment_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  monthly_payment numeric,
  first_payment_date timestamptz,
  total_repayment numeric,
  outstanding_balance numeric,
  has_credit_life_insurance boolean not null
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text,
  message text not null,
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id bigint generated always as identity primary key,
  loan_id bigint not null,
  user_id uuid not null,
  amount numeric not null,
  payment_date timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists payouts (
  id bigint generated always as identity primary key,
  application_id bigint not null,
  user_id uuid not null,
  amount numeric not null,
  status text not null,
  disbursed_by_admin uuid,
  disbursed_at timestamptz,
  created_at timestamptz not null default now(),
  payment_method text,
  cashsend_fee numeric,
  third_party_name text,
  third_party_bank text,
  third_party_account text,
  third_party_ref text,
  payout_notes text
);

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  avatar_url text,
  contact_number text,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text,
  identity_number text,
  branch_id bigint,
  first_name text,
  last_name text,
  gender text,
  date_of_birth date,
  address text,
  postal_code text,
  suburb_area text,
  cell_tel_no text,
  nok_name text,
  nok_phone text,
  nok_relationship text,
  credit_limit_override numeric,
  credit_limit_note text,
  employer_name text,
  employer_phone text,
  employer_address text,
  employer_verified boolean,
  employer_verified_at timestamptz,
  employer_verified_by text,
  last_active_at timestamptz
);

create table if not exists sacrra_account_states (
  account_id bigint not null,
  as_of_month date not null,
  status_code text not null,
  payment_type text,
  months_in_arrears smallint not null,
  current_balance numeric not null,
  overdue_balance numeric not null,
  instalment numeric not null,
  last_payment_date date,
  last_payment_amt numeric,
  created_at timestamptz not null default now()
);

create table if not exists sacrra_accounts (
  id bigint generated always as identity primary key,
  loan_id bigint,
  supplier_ref text not null,
  account_no text not null,
  sub_account text not null,
  branch_code text,
  account_type text not null,
  sub_type text,
  opened_on date,
  closed_on date,
  old_supplier_ref text,
  old_account_no text,
  old_sub text,
  old_branch text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sacrra_bureau_config (
  bureau text not null,
  updated_at timestamptz not null default now(),
  endpoint text,
  auth_header text,
  enabled boolean,
  public_key text,
  transport text,
  sftp_host text,
  sftp_port integer,
  sftp_username text,
  sftp_password text,
  sftp_remote_path text
);

create table if not exists sacrra_consumers (
  consumer_id uuid,
  sa_id text,
  surname text,
  forename1 text,
  dob date,
  gender text,
  address text,
  postal_code text,
  suburb_area text,
  phone text,
  email text,
  branch_id bigint
);

create table if not exists sacrra_conversions (
  id uuid primary key default gen_random_uuid(),
  new_account_no text not null,
  old_account_no text not null,
  old_sub_account_no text,
  old_supplier_branch text,
  old_supplier_ref text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists sacrra_extract_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  month_end date,
  frequency text,
  filename text,
  account_type text,
  record_count integer,
  rejected_count integer,
  status text
);

create table if not exists sacrra_rejections (
  id bigint generated always as identity primary key,
  submission_id bigint,
  account_id bigint,
  record_no integer,
  code text not null,
  severity text not null,
  field text,
  message text,
  resolved boolean not null,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  run_id uuid,
  account_number text,
  field_name text,
  error_message text,
  match_key text not null,
  error_code text not null,
  updated_at timestamptz not null default now()
);

create table if not exists sacrra_submissions (
  id bigint generated always as identity primary key,
  kind text not null,
  period date not null,
  bureau text not null,
  file_name text not null,
  seq integer not null,
  record_count integer not null,
  reject_count integer not null,
  sent_at timestamptz,
  ack_at timestamptz,
  created_at timestamptz not null default now(),
  run_id uuid,
  filename text,
  http_status integer,
  response_body text,
  success boolean,
  status text not null,
  submission_type text not null,
  notes text,
  updated_at timestamptz not null default now()
);

create table if not exists sacrra_supplier_config (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  supplier_ref text,
  trading_name text,
  default_account_type text,
  active boolean
);

create table if not exists suresystems_mandates (
  id bigint generated always as identity primary key,
  application_id bigint not null,
  user_id uuid,
  status text not null,
  contract_reference text,
  message text,
  request_payload jsonb,
  response_payload jsonb,
  error_payload jsonb,
  activated_at timestamptz not null,
  last_checked_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists system_event_log (
  id bigint generated always as identity primary key,
  event_type text not null,
  severity text,
  event_description text not null,
  event_data jsonb,
  affected_users_count integer,
  resolution_status text,
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists system_settings (
  id text primary key,
  primary_color text not null,
  secondary_color text not null,
  tertiary_color text not null,
  theme_mode text not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  company_logo_url text,
  auth_background_url text,
  carousel_slides jsonb not null,
  auth_background_flip boolean not null,
  auth_overlay_color text not null,
  auth_overlay_enabled boolean not null,
  company_name text,
  ncr_number text,
  company_reg_number text,
  company_vat_number text,
  provider_branch_code text,
  company_phone text,
  company_physical_address text,
  company_postal_address text,
  sacrra_bureau_public_key text
);

create table if not exists truid_bank_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  collection_id text not null,
  bank_name text,
  customer_name text,
  captured_at timestamptz not null,
  months_captured integer not null,
  total_income numeric not null,
  total_expenses numeric not null,
  avg_monthly_income numeric not null,
  avg_monthly_expenses numeric not null,
  net_monthly_income numeric not null,
  main_salary numeric not null,
  salary_payment_date timestamptz,
  summary_data jsonb,
  raw_statement jsonb
);

create table if not exists truid_collections (
  id bigint generated always as identity primary key,
  collection_id text not null,
  user_id uuid,
  application_id text,
  consent_id text,
  consumer_url text,
  status text,
  normalized_status text,
  verified boolean not null,
  correlation jsonb,
  collection_payload jsonb,
  summary_payload jsonb,
  capture_attempts integer not null,
  captured_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_action_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action_type text not null,
  target_type text not null,
  target_id bigint not null,
  action_details jsonb,
  notes text,
  approval_reason text,
  decline_reason text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
-- ================================================================
-- AlgoLend — Phase 1–5 Full Migration
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards)
-- ================================================================

-- ── 1. APPLICATION STATUS ENUM ───────────────────────────────────
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'IN_ARREARS';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'IN_DEFAULT';

-- ── 2. PROFILES — NOK, employer, credit cap, activity ────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nok_name              text,
  ADD COLUMN IF NOT EXISTS nok_phone             text,
  ADD COLUMN IF NOT EXISTS nok_relationship      text,
  ADD COLUMN IF NOT EXISTS credit_limit_override numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS credit_limit_note     text,
  ADD COLUMN IF NOT EXISTS employer_name         text,
  ADD COLUMN IF NOT EXISTS employer_phone        text,
  ADD COLUMN IF NOT EXISTS employer_address      text,
  ADD COLUMN IF NOT EXISTS employer_verified     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS employer_verified_at  timestamptz,
  ADD COLUMN IF NOT EXISTS employer_verified_by  text,
  ADD COLUMN IF NOT EXISTS last_active_at        timestamptz;

-- ── 3. LOAN APPLICATIONS — purpose, loan number, credit decision ──
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS loan_purpose             text,
  ADD COLUMN IF NOT EXISTS loan_number              bigserial,
  ADD COLUMN IF NOT EXISTS credit_decision          text,
  ADD COLUMN IF NOT EXISTS credit_band_label        text,
  ADD COLUMN IF NOT EXISTS credit_band_color        text,
  ADD COLUMN IF NOT EXISTS credit_max_loan          numeric(12,2),
  ADD COLUMN IF NOT EXISTS credit_rate_pa           numeric(5,2),
  ADD COLUMN IF NOT EXISTS credit_max_term          integer,
  ADD COLUMN IF NOT EXISTS credit_decline_reasons   jsonb,
  ADD COLUMN IF NOT EXISTS first_loan_restriction   text,
  ADD COLUMN IF NOT EXISTS is_first_loan            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS routed_to_head_office    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_number         text;

-- Loan number sequence — first loan will be L1000
SELECT setval(pg_get_serial_sequence('loan_applications', 'loan_number'), 999);

-- ── 4. CREDIT CHECKS — NCR reference ─────────────────────────────
ALTER TABLE public.credit_checks
  ADD COLUMN IF NOT EXISTS ncr_reference   text,
  ADD COLUMN IF NOT EXISTS reported_to_ncr boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reported_at     timestamptz;

-- ── 5. SCORE BANDS — first loan term restriction ──────────────────
ALTER TABLE public.credit_score_bands
  ADD COLUMN IF NOT EXISTS first_loan_max_term_months integer DEFAULT NULL;

-- Set first loan = 1 month for existing AlgoLend bands
UPDATE public.credit_score_bands
SET first_loan_max_term_months = 1
WHERE organization_id = (SELECT id FROM public.organizations WHERE code = 'algolend');

-- ── 6. CASH JOURNAL ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_journal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date      date NOT NULL DEFAULT CURRENT_DATE,
  entry_type      text NOT NULL CHECK (entry_type IN ('cash_in','cash_out','opening_balance','closing_balance','adjustment')),
  category        text,
  description     text NOT NULL,
  amount          numeric(12,2) NOT NULL,
  reference       text,
  branch_id       bigint REFERENCES public.branches(id),
  created_by      uuid REFERENCES auth.users(id),
  created_by_name text,
  is_locked       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.cash_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage cash journal" ON public.cash_journal;
DROP POLICY IF EXISTS "Service reads cash journal"  ON public.cash_journal;

CREATE POLICY "Admins manage cash journal"
  ON public.cash_journal FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

CREATE POLICY "Service reads cash journal"
  ON public.cash_journal FOR SELECT USING (true);

-- ── 7. AUDIT LOG ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       text NOT NULL,
  entity_id         text NOT NULL,
  action            text NOT NULL,
  old_value         jsonb,
  new_value         jsonb,
  description       text,
  performed_by      uuid REFERENCES auth.users(id),
  performed_by_name text,
  branch_id         bigint REFERENCES public.branches(id),
  ip_address        text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log"  ON public.audit_log;
DROP POLICY IF EXISTS "Service inserts audit"   ON public.audit_log;

CREATE POLICY "Admins read audit log"
  ON public.audit_log FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

CREATE POLICY "Service inserts audit"
  ON public.audit_log FOR INSERT WITH CHECK (true);

-- ── 8. CREDIT RULES (organisations, bands, eligibility) ───────────
-- (Full script in migrations/credit_rules.sql)
-- If not already run, execute migrations/credit_rules.sql first.

-- ── 9. ORGANISATIONS (if credit_rules.sql already ran, skip) ──────
INSERT INTO public.organizations (name, code)
VALUES ('AlgoLend', 'algolend')
ON CONFLICT (code) DO NOTHING;

-- ── 10. INDEXES (performance) ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_entity    ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created   ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_journal_date   ON public.cash_journal (entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_journal_branch ON public.cash_journal (branch_id);
CREATE INDEX IF NOT EXISTS idx_loan_apps_status    ON public.loan_applications (status);
CREATE INDEX IF NOT EXISTS idx_loan_apps_user      ON public.loan_applications (user_id);

-- ── Done ──────────────────────────────────────────────────────────
-- After running this script:
-- 1. The server will stop throwing "invalid input value for enum application_status: ACTIVE"
-- 2. Cash Ledger (/admin/cash-ledger) will work
-- 3. Audit Trail tab on application detail will work
-- 4. Loan numbers will start from L1000
-- 5. First loan term restrictions will be active
-- ================================================================
-- Credit Rules Engine — White-Label Per-Client Configuration
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Organizations (white-label lender clients)
CREATE TABLE IF NOT EXISTS public.organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  code          text UNIQUE NOT NULL,  -- slug, e.g. 'algolend', 'mintlend'
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Seed the default org for this deployment
INSERT INTO public.organizations (name, code)
VALUES ('AlgoLend', 'algolend')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------
-- 2. Credit Score Bands
--    Defines what each score range means: risk, max loan, rate
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_score_bands (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  label               text NOT NULL,               -- e.g. "Excellent", "Good"
  min_score           integer NOT NULL,
  max_score           integer NOT NULL,
  risk_level          text NOT NULL CHECK (risk_level IN ('low','medium','high','declined')),
  color               text DEFAULT '#10b981',      -- hex for UI badge

  -- Loan offer limits
  max_loan_amount     numeric(12,2) NOT NULL DEFAULT 0,
  interest_rate_pa    numeric(5,2)  NOT NULL DEFAULT 0,  -- Annual %
  max_term_months     integer DEFAULT 12,
  initiation_fee_pct  numeric(5,2)  DEFAULT 0,           -- % of loan amount
  monthly_service_fee numeric(10,2) DEFAULT 0,           -- flat monthly fee

  -- Auto-decisioning
  auto_decision       text DEFAULT 'review' CHECK (auto_decision IN ('approve','review','decline')),

  is_active           boolean DEFAULT true,
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  CONSTRAINT no_overlapping_bands UNIQUE (organization_id, min_score, max_score)
);

-- Seed sensible defaults for AlgoLend
INSERT INTO public.credit_score_bands
  (organization_id, label, min_score, max_score, risk_level, color,
   max_loan_amount, interest_rate_pa, max_term_months, auto_decision, sort_order)
SELECT
  o.id,
  b.label, b.min_score, b.max_score, b.risk_level, b.color,
  b.max_loan, b.rate, b.term, b.decision, b.ord
FROM public.organizations o
CROSS JOIN (VALUES
  ('Excellent',  800, 999, 'low',      '#10b981', 20000, 18.00, 24, 'approve', 1),
  ('Good',       700, 799, 'low',      '#3b82f6', 15000, 22.00, 18, 'approve', 2),
  ('Fair',       580, 699, 'medium',   '#f59e0b', 8000,  27.50, 12, 'review',  3),
  ('Poor',       300, 579, 'high',     '#ef4444', 3000,  35.00,  6, 'review',  4),
  ('Declined',     0, 299, 'declined', '#6b7280', 0,     0,      0, 'decline', 5)
) AS b(label, min_score, max_score, risk_level, color, max_loan, rate, term, decision, ord)
WHERE o.code = 'algolend'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------
-- 3. Eligibility Rules
--    Hard pass/fail criteria checked before score bands
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_eligibility_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  rule_key          text NOT NULL,  -- machine key
  rule_label        text NOT NULL,  -- human label for admin UI
  description       text,           -- tooltip/help text

  operator          text NOT NULL CHECK (operator IN ('gte','lte','eq','neq','is_true','is_false')),
  threshold_value   text,           -- e.g. "500", "21", "0.45"

  fail_action       text NOT NULL DEFAULT 'decline' CHECK (fail_action IN ('decline','review')),
  decline_reason    text,           -- shown to borrower on decline

  is_active         boolean DEFAULT true,
  sort_order        integer DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),

  UNIQUE(organization_id, rule_key)
);

-- Seed common South African micro-lending rules
INSERT INTO public.credit_eligibility_rules
  (organization_id, rule_key, rule_label, description, operator, threshold_value,
   fail_action, decline_reason, sort_order)
SELECT
  o.id,
  r.rule_key, r.label, r.description, r.operator, r.threshold,
  r.fail_action, r.reason, r.ord
FROM public.organizations o
CROSS JOIN (VALUES
  ('min_credit_score',
   'Minimum Credit Score',
   'Applicant must have at least this Experian score to qualify.',
   'gte', '300', 'decline',
   'Your credit score does not meet our minimum requirement.', 1),

  ('min_monthly_income',
   'Minimum Monthly Income (R)',
   'Gross monthly income before deductions.',
   'gte', '3000', 'decline',
   'Your declared monthly income is below our minimum requirement.', 2),

  ('max_debt_to_income_pct',
   'Maximum Debt-to-Income Ratio (%)',
   'Total monthly debt obligations as a % of gross income. E.g. 45 = 45%.',
   'lte', '45', 'review',
   'Your current debt obligations are too high relative to your income.', 3),

  ('min_age',
   'Minimum Applicant Age',
   'Applicant must be at least this age (years).',
   'gte', '18', 'decline',
   'You must be at least 18 years old to apply.', 4),

  ('max_age',
   'Maximum Applicant Age',
   'Applicant must not exceed this age (years).',
   'lte', '65', 'review',
   'Your age falls outside our standard lending criteria.', 5),

  ('no_active_judgments',
   'No Active Court Judgments',
   'Applicant must have no active court judgments on their credit profile.',
   'is_true', null, 'decline',
   'Active court judgments have been found on your credit profile.', 6),

  ('no_sequestration',
   'No Active Sequestration/Administration',
   'Applicant must not be under debt review, sequestration or administration.',
   'is_true', null, 'decline',
   'You are currently under debt review or administration.', 7),

  ('employed_or_self_employed',
   'Must Be Employed or Self-Employed',
   'Applicant must have a regular income source.',
   'is_true', null, 'decline',
   'Proof of employment or income is required to apply.', 8)
) AS r(rule_key, label, description, operator, threshold, fail_action, reason, ord)
WHERE o.code = 'algolend'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------
ALTER TABLE public.organizations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_score_bands      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_eligibility_rules ENABLE ROW LEVEL SECURITY;

-- Admins can read/write everything
CREATE POLICY "Admins manage organizations"
  ON public.organizations FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

CREATE POLICY "Admins manage credit bands"
  ON public.credit_score_bands FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

CREATE POLICY "Admins manage eligibility rules"
  ON public.credit_eligibility_rules FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

-- Service role (backend API) can read everything
CREATE POLICY "Service reads organizations"
  ON public.organizations FOR SELECT USING (true);

CREATE POLICY "Service reads credit bands"
  ON public.credit_score_bands FOR SELECT USING (true);

CREATE POLICY "Service reads eligibility rules"
  ON public.credit_eligibility_rules FOR SELECT USING (true);

-- ---------------------------------------------------------------
-- 5. Helper: updated_at trigger
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_updated_at           ON public.organizations;
DROP TRIGGER IF EXISTS trg_credit_score_bands_updated_at      ON public.credit_score_bands;
DROP TRIGGER IF EXISTS trg_credit_eligibility_rules_updated_at ON public.credit_eligibility_rules;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_credit_score_bands_updated_at
  BEFORE UPDATE ON public.credit_score_bands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_credit_eligibility_rules_updated_at
  BEFORE UPDATE ON public.credit_eligibility_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
-- Add client_number to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS client_number TEXT;

-- Auto-generate client numbers for existing profiles that don't have one
-- Format: C + zero-padded sequential number based on created_at order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn
  FROM public.profiles
  WHERE client_number IS NULL
)
UPDATE public.profiles p
SET client_number = 'C' || LPAD(n.rn::TEXT, 4, '0')
FROM numbered n
WHERE p.id = n.id;

-- Create a sequence-based function for new profiles
CREATE OR REPLACE FUNCTION assign_client_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  IF NEW.client_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(client_number FROM 2) AS INTEGER)), 0) + 1
    INTO next_num
    FROM public.profiles
    WHERE client_number ~ '^C[0-9]+$';
    NEW.client_number := 'C' || LPAD(next_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assign_client_number ON public.profiles;
CREATE TRIGGER trigger_assign_client_number
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_client_number();
-- =====================================================================
-- Add legal/compliance fields to system_settings
-- Add credit life + VAT fields to loan_applications
-- Run once in Supabase SQL Editor
-- =====================================================================

-- system_settings: company legal identity for DocuSeal contracts
alter table public.system_settings
  add column if not exists ncr_number          text default 'NCRCP13510',
  add column if not exists company_reg_number  text default '2023/123456/07',
  add column if not exists company_vat_number  text default '4012345678',
  add column if not exists provider_branch_code text default 'ZFS',
  add column if not exists company_phone       text default '0691195046',
  add column if not exists company_physical_address text default '',
  add column if not exists company_postal_address   text default '';

-- loan_applications: NCA fee breakdown fields
alter table public.loan_applications
  add column if not exists offer_credit_life_monthly numeric(12,2) default 0,
  add column if not exists offer_vat_amount          numeric(12,2) default 0,
  add column if not exists offer_total_cost_of_credit numeric(12,2) default 0;
-- Add loan referencing support for client tracking and SACRRA integration
-- Format: ClientNumber-LoanNumber (e.g., C001-L001)

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS client_reference TEXT NULL;

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS loan_reference TEXT NULL;

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS agreement_number TEXT NULL;

-- Create unique index on loan_reference for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS loan_applications_loan_reference_uidx
  ON public.loan_applications (loan_reference)
  WHERE loan_reference IS NOT NULL;

-- Create index on client_reference for lookups
CREATE INDEX IF NOT EXISTS loan_applications_client_reference_idx
  ON public.loan_applications (client_reference)
  WHERE client_reference IS NOT NULL;

-- Create index on agreement_number for matching
CREATE INDEX IF NOT EXISTS loan_applications_agreement_number_idx
  ON public.loan_applications (agreement_number)
  WHERE agreement_number IS NOT NULL;

-- Add to loans table as well for consistency
ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS client_reference TEXT NULL;

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS loan_reference TEXT NULL;

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS agreement_number TEXT NULL;

CREATE INDEX IF NOT EXISTS loans_loan_reference_idx
  ON public.loans (loan_reference)
  WHERE loan_reference IS NOT NULL;

-- Add SACRRA-related fields for back-dating support
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS sacrra_reference TEXT NULL;

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS sacrra_submitted_at TIMESTAMPTZ NULL;

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS sacrra_reference TEXT NULL;
-- Payout and Disbursement System
-- Handles Capitec, CashSend, and other payment methods

-- Disbursement tracking
CREATE TABLE IF NOT EXISTS public.disbursements (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Disbursement details
  amount NUMERIC(12, 2) NOT NULL,
  disbursement_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, reversed

  -- Payout method
  payout_method TEXT NOT NULL, -- 'capitec', 'cashsend', 'third_party', 'cash'
  bank_account_id BIGINT REFERENCES public.bank_accounts(id) ON DELETE SET NULL,

  -- CashSend specifics
  cashsend_reference TEXT NULL,
  cashsend_fee NUMERIC(12, 2) DEFAULT 0,

  -- Third party (other than client)
  third_party_name TEXT NULL,
  third_party_account TEXT NULL,
  third_party_bank TEXT NULL,

  -- Capitec API integration
  capitec_batch_id TEXT NULL,
  capitec_transaction_id TEXT NULL,
  capitec_response JSONB NULL,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS disbursements_application_id_idx ON public.disbursements(application_id);
CREATE INDEX IF NOT EXISTS disbursements_user_id_idx ON public.disbursements(user_id);
CREATE INDEX IF NOT EXISTS disbursements_status_idx ON public.disbursements(status);
CREATE INDEX IF NOT EXISTS disbursements_payout_method_idx ON public.disbursements(payout_method);
CREATE INDEX IF NOT EXISTS disbursements_capitec_batch_id_idx ON public.disbursements(capitec_batch_id);

-- CashSend configuration & fee structure
CREATE TABLE IF NOT EXISTS public.cashsend_config (
  id BIGSERIAL PRIMARY KEY,
  base_fee NUMERIC(12, 2) NOT NULL DEFAULT 5.00,
  percentage_fee NUMERIC(5, 2) NOT NULL DEFAULT 2.50, -- % of amount
  min_amount NUMERIC(12, 2) NOT NULL DEFAULT 100,
  max_amount NUMERIC(12, 2) NOT NULL DEFAULT 50000,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Payout audit trail
CREATE TABLE IF NOT EXISTS public.payout_audit_log (
  id BIGSERIAL PRIMARY KEY,
  disbursement_id BIGINT NOT NULL REFERENCES public.disbursements(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'submitted', 'approved', 'sent', 'failed', 'reversed'
  details JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS payout_audit_log_disbursement_id_idx ON public.payout_audit_log(disbursement_id);
CREATE INDEX IF NOT EXISTS payout_audit_log_action_idx ON public.payout_audit_log(action);

-- CSV export tracking (locked after export)
CREATE TABLE IF NOT EXISTS public.payout_csv_exports (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL, -- 'capitec', 'cashsend', 'all'
  record_count INT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  status TEXT DEFAULT 'exported', -- exported, uploaded, archived
  csv_hash TEXT NOT NULL, -- SHA256 of CSV content for integrity
  locked BOOLEAN DEFAULT true, -- prevent further modifications
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS payout_csv_exports_batch_id_idx ON public.payout_csv_exports(batch_id);
CREATE INDEX IF NOT EXISTS payout_csv_exports_method_idx ON public.payout_csv_exports(method);

-- Update trigger for disbursements
CREATE OR REPLACE FUNCTION public.touch_disbursements_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_disbursements_updated_at ON public.disbursements;
CREATE TRIGGER trg_touch_disbursements_updated_at
BEFORE UPDATE ON public.disbursements
FOR EACH ROW
EXECUTE FUNCTION public.touch_disbursements_updated_at();

-- Default CashSend config (insert if not exists)
INSERT INTO public.cashsend_config (base_fee, percentage_fee)
VALUES (5.00, 2.50)
ON CONFLICT DO NOTHING;
-- Add in-default amount tracking to loans
-- Calculates: current_balance × 3% when loan enters default status

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS in_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_date DATE NULL,
  ADD COLUMN IF NOT EXISTS default_amount NUMERIC(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS last_payment_date DATE NULL;

-- Create index for default tracking queries
CREATE INDEX IF NOT EXISTS loans_in_default_idx ON public.loans(in_default);
CREATE INDEX IF NOT EXISTS loans_default_date_idx ON public.loans(default_date);

-- Function to calculate default amount (3% of current balance)
CREATE OR REPLACE FUNCTION calculate_default_amount(loan_id BIGINT)
RETURNS NUMERIC AS $$
DECLARE
  current_bal NUMERIC;
  default_amt NUMERIC;
BEGIN
  SELECT current_balance INTO current_bal
  FROM public.loans
  WHERE id = loan_id;

  IF current_bal IS NULL OR current_bal <= 0 THEN
    RETURN 0;
  END IF;

  default_amt := current_bal * 0.03;
  RETURN ROUND(default_amt, 2);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update default amount when loan enters default
CREATE OR REPLACE FUNCTION update_default_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.in_default = true AND OLD.in_default = false THEN
    NEW.default_date := CURRENT_DATE;
    NEW.default_amount := calculate_default_amount(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_default_amount ON public.loans;
CREATE TRIGGER trg_update_default_amount
  BEFORE UPDATE ON public.loans
  FOR EACH ROW
  EXECUTE FUNCTION update_default_amount();

-- Add in-default tracking to loan history table
ALTER TABLE public.loan_history
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_amount_calculated NUMERIC(12, 2) NULL;
-- Add Experian affordability assessment fields
-- Clients & consultants can input; consultant can override
-- Focus: remove expense tracking, add toggles for additional income

ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS monthly_income NUMERIC(12, 2) NULL;

-- Additional income sources: can be toggled on/off for affordability calc
ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS other_income_sources JSONB DEFAULT '{}'; -- {source: amount, include: bool}

ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS other_bank_accounts JSONB DEFAULT '{}'; -- {bank: amount, account_type: text}

ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS affordability_ratio NUMERIC(12, 2) NULL;

ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS affordability_source TEXT DEFAULT 'manual'; -- 'experian', 'manual', 'hybrid'

ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS experian_reference TEXT NULL;

ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS decline_reason TEXT NULL;

ALTER TABLE public.financial_profiles
  ADD COLUMN IF NOT EXISTS show_decline_reason BOOLEAN DEFAULT false;

-- Remove expense tracking (not needed per requirements)
ALTER TABLE public.financial_profiles
  DROP COLUMN IF EXISTS expenses;

ALTER TABLE public.financial_profiles
  DROP COLUMN IF EXISTS monthly_expenses;

-- Create index for affordability source lookups
CREATE INDEX IF NOT EXISTS financial_profiles_affordability_source_idx
  ON public.financial_profiles (affordability_source);

CREATE INDEX IF NOT EXISTS financial_profiles_experian_reference_idx
  ON public.financial_profiles (experian_reference);
-- Adds Credit Life insurance support for applications and loans
-- Run this in Supabase SQL editor before/with deploy.

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS has_credit_life_insurance boolean NOT NULL DEFAULT false;

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS offer_credit_life_monthly numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.loans
  ADD COLUMN IF NOT EXISTS has_credit_life_insurance boolean NOT NULL DEFAULT false;

-- Optional backfill from JSON offer_details for existing records
UPDATE public.loan_applications
SET has_credit_life_insurance = COALESCE((offer_details->>'credit_life_enabled')::boolean, false)
WHERE offer_details ? 'credit_life_enabled'
  AND has_credit_life_insurance = false;

UPDATE public.loans l
SET has_credit_life_insurance = COALESCE(a.has_credit_life_insurance, false)
FROM public.loan_applications a
WHERE l.application_id = a.id
  AND l.has_credit_life_insurance = false;
-- Comprehensive Audit Trail System
-- Tracks all loan state changes, user actions, and financial movements

CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'loan', 'application', 'disbursement', 'user', 'system'
  entity_id BIGINT NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'approved', 'declined', 'disbursed', etc.
  old_values JSONB NULL, -- previous values before change
  new_values JSONB NULL, -- new values after change
  changes_summary TEXT NULL, -- human-readable summary of changes
  metadata JSONB NULL, -- additional context (IP, user agent, location, etc.)
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_type_idx ON public.audit_log(entity_type);
CREATE INDEX IF NOT EXISTS audit_log_entity_id_idx ON public.audit_log(entity_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log(created_at);

-- Loan state change tracking
CREATE TABLE IF NOT EXISTS public.loan_state_history (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  previous_balance NUMERIC(12, 2),
  new_balance NUMERIC(12, 2),
  previous_payment_date DATE,
  new_payment_date DATE,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loan_state_history_loan_id_idx ON public.loan_state_history(loan_id);
CREATE INDEX IF NOT EXISTS loan_state_history_user_id_idx ON public.loan_state_history(user_id);
CREATE INDEX IF NOT EXISTS loan_state_history_status_idx ON public.loan_state_history(new_status);
CREATE INDEX IF NOT EXISTS loan_state_history_created_at_idx ON public.loan_state_history(created_at);

-- User action tracking (approvals, overrides, approvals)
CREATE TABLE IF NOT EXISTS public.user_action_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'approval', 'decline', 'override', 'review', 'export', 'delete'
  target_type TEXT NOT NULL, -- 'application', 'loan', 'disbursement', 'report'
  target_id BIGINT NOT NULL,
  action_details JSONB,
  notes TEXT,
  approval_reason TEXT,
  decline_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_action_log_user_id_idx ON public.user_action_log(user_id);
CREATE INDEX IF NOT EXISTS user_action_log_action_type_idx ON public.user_action_log(action_type);
CREATE INDEX IF NOT EXISTS user_action_log_target_type_idx ON public.user_action_log(target_type);
CREATE INDEX IF NOT EXISTS user_action_log_created_at_idx ON public.user_action_log(created_at);

-- Financial transaction tracking
CREATE TABLE IF NOT EXISTS public.financial_transaction_log (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'payment', 'fee', 'interest', 'default_charge', 'reversal'
  amount NUMERIC(12, 2) NOT NULL,
  balance_before NUMERIC(12, 2),
  balance_after NUMERIC(12, 2),
  reference_number TEXT,
  external_reference TEXT,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'reversed'
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS financial_transaction_log_loan_id_idx ON public.financial_transaction_log(loan_id);
CREATE INDEX IF NOT EXISTS financial_transaction_log_type_idx ON public.financial_transaction_log(transaction_type);
CREATE INDEX IF NOT EXISTS financial_transaction_log_created_at_idx ON public.financial_transaction_log(created_at);

-- Admin action tracking for compliance
CREATE TABLE IF NOT EXISTS public.admin_action_audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_category TEXT NOT NULL, -- 'application_management', 'loan_management', 'payout_management', 'system_config'
  action_description TEXT NOT NULL,
  affected_records JSONB, -- list of affected application/loan IDs
  risk_level TEXT DEFAULT 'low', -- 'low', 'medium', 'high'
  ip_address INET,
  session_id TEXT,
  approval_status TEXT, -- 'pending_review', 'approved', 'rejected'
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_action_audit_admin_id_idx ON public.admin_action_audit(admin_id);
CREATE INDEX IF NOT EXISTS admin_action_audit_category_idx ON public.admin_action_audit(action_category);
CREATE INDEX IF NOT EXISTS admin_action_audit_risk_level_idx ON public.admin_action_audit(risk_level);
CREATE INDEX IF NOT EXISTS admin_action_audit_created_at_idx ON public.admin_action_audit(created_at);

-- System events log (configuration changes, errors, etc.)
CREATE TABLE IF NOT EXISTS public.system_event_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'config_change', 'error', 'warning', 'integration_call', 'scheduled_task'
  severity TEXT DEFAULT 'info', -- 'debug', 'info', 'warning', 'error', 'critical'
  event_description TEXT NOT NULL,
  event_data JSONB,
  affected_users_count INT DEFAULT 0,
  resolution_status TEXT DEFAULT 'unresolved', -- 'unresolved', 'investigating', 'resolved'
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS system_event_log_type_idx ON public.system_event_log(event_type);
CREATE INDEX IF NOT EXISTS system_event_log_severity_idx ON public.system_event_log(severity);
CREATE INDEX IF NOT EXISTS system_event_log_created_at_idx ON public.system_event_log(created_at);

-- View for recent audit activity
CREATE OR REPLACE VIEW public.recent_audit_activity AS
SELECT
  'audit' as log_type,
  id,
  user_id,
  entity_type,
  action,
  created_at,
  entity_id
FROM public.audit_log
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'state_change' as log_type,
  id,
  user_id,
  'loan' as entity_type,
  new_status as action,
  created_at,
  loan_id as entity_id
FROM public.loan_state_history
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'user_action' as log_type,
  id,
  user_id,
  target_type as entity_type,
  action_type as action,
  created_at,
  target_id as entity_id
FROM public.user_action_log
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
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
-- ════════════════════════════════════════════════════════════════
-- SACRRA Bureau Configuration
-- One row per bureau (Experian, TransUnion, XDS, Compuscan)
-- Run once in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sacrra_bureaux (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bureau_key          text UNIQUE NOT NULL,   -- 'experian' | 'transunion' | 'xds' | 'compuscan'
    bureau_name         text NOT NULL,           -- Display name
    is_enabled          boolean DEFAULT true,

    -- Identification (each bureau issues their own SRN)
    supplier_ref_number text,                    -- 10-char SRN issued by bureau
    pgp_public_key      text,                    -- Bureau's PGP public key for encryption

    -- Submission method
    submission_method   text NOT NULL DEFAULT 'email' CHECK (submission_method IN ('moveit','email','sftp')),
    submission_email    text,                    -- For 'email' method — where to send the .pgp file
    submission_host     text,                    -- For 'sftp' method
    submission_username text,
    submission_password text,                    -- Encrypted at rest by Supabase
    submission_folder   text,                    -- Upload folder ID/path

    -- Last submission tracking
    last_submitted_at   timestamptz,
    last_submission_status text,                 -- 'success' | 'failed' | 'pending'
    last_submission_note   text,

    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Seed the 4 bureaux (idempotent)
INSERT INTO public.sacrra_bureaux (bureau_key, bureau_name, submission_method, submission_email) VALUES
    ('experian',   'Experian',    'moveit', NULL),
    ('transunion', 'TransUnion',  'email',  NULL),
    ('xds',        'XDS',         'email',  NULL),
    ('compuscan', 'Compuscan',   'email',  NULL)
ON CONFLICT (bureau_key) DO NOTHING;

ALTER TABLE public.sacrra_bureaux ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.sacrra_bureaux;
CREATE POLICY "service_role_all" ON public.sacrra_bureaux FOR ALL USING (true);
-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View
-- Replaces sacrra_700_view; reads from loan_applications + profiles
-- Run once in Supabase SQL Editor
-- =====================================================================
-- Actual profiles columns used:
--   identity_number, gender, date_of_birth, first_name, last_name,
--   address, suburb_area, postal_code, cell_tel_no, contact_number
-- =====================================================================
-- Status code mapping (app status → Layout 700 code):
--   DISBURSED / ACTIVE / DEBICHECK_AUTH / READY_TO_DISBURSE  → C (Current)
--   OFFER_ACCEPTED / CONTRACT_SIGN                           → P (Payment arrangement)
--   IN_DEFAULT                                               → D (Delinquent)
--   CLOSED / PAID_UP / REPAID                               → T (Paid up)
--   CANCELLED / REJECTED / DECLINED / BUREAU_DECLINE        → V (Cancelled)
--   Everything else                                          → L (Legal / hold)
-- =====================================================================

CREATE OR REPLACE VIEW public.sacrra_700_view AS
SELECT
    la.id::text                                                  AS internal_id,

    -- Record type
    'R'                                                          AS f01_record_type,

    -- Supplier Reference Number (SRN) — 6 chars: 2 letters + 4 digits
    RPAD(COALESCE(
        (SELECT provider_branch_code FROM public.system_settings LIMIT 1),
        'AL0001'
    ), 6, ' ')                                                   AS f02_supplier_ref,

    -- Account Number (unique match key — no spaces)
    REPLACE(la.id::text, ' ', '')                                AS f40_account_number,

    -- Account type: M = one-month personal loan, P = personal loan
    CASE
        WHEN COALESCE(la.term_months, 1) = 1 THEN 'M'
        ELSE 'P'
    END                                                          AS f03_account_type,

    -- Status code mapped from application status (cast to text to avoid enum errors)
    CASE la.status::text
        WHEN 'DISBURSED'          THEN 'C'
        WHEN 'ACTIVE'             THEN 'C'
        WHEN 'DEBICHECK_AUTH'     THEN 'C'
        WHEN 'READY_TO_DISBURSE'  THEN 'C'
        WHEN 'OFFER_ACCEPTED'     THEN 'P'
        WHEN 'CONTRACT_SIGN'      THEN 'P'
        WHEN 'IN_DEFAULT'         THEN 'D'
        WHEN 'CLOSED'             THEN 'T'
        WHEN 'PAID_UP'            THEN 'T'
        WHEN 'REPAID'             THEN 'T'
        WHEN 'CANCELLED'          THEN 'V'
        WHEN 'REJECTED'           THEN 'V'
        WHEN 'DECLINED'           THEN 'V'
        WHEN 'BUREAU_DECLINE'     THEN 'V'
        ELSE                           'L'
    END                                                          AS f50_status_code,

    -- Status date (YYYYMMDD)
    TO_CHAR(COALESCE(la.updated_at, la.created_at), 'YYYYMMDD') AS f51_status_date,

    -- Account opened date (YYYYMMDD)
    TO_CHAR(la.created_at, 'YYYYMMDD')                          AS f43_date_opened,

    -- Financial fields (rand * 100 = cents, 12-digit zero-padded)
    LPAD((COALESCE(la.offer_principal, la.amount, 0) * 100)::bigint::text, 12, '0')
                                                                 AS f41_opening_balance,

    LPAD((
        CASE la.status::text
            WHEN 'CLOSED'        THEN 0
            WHEN 'PAID_UP'       THEN 0
            WHEN 'REPAID'        THEN 0
            WHEN 'CANCELLED'     THEN 0
            WHEN 'REJECTED'      THEN 0
            WHEN 'DECLINED'      THEN 0
            WHEN 'BUREAU_DECLINE' THEN 0
            ELSE COALESCE(la.offer_total_repayment, la.offer_principal, la.amount, 0)
        END * 100
    )::bigint::text, 12, '0')                                    AS f44_current_balance,

    LPAD((COALESCE(la.offer_monthly_repayment, 0) * 100)::bigint::text, 12, '0')
                                                                 AS f45_installment,

    -- Arrears (only populated for IN_DEFAULT)
    LPAD((
        CASE la.status::text
            WHEN 'IN_DEFAULT' THEN COALESCE(la.offer_monthly_repayment, 0)
            ELSE 0
        END * 100
    )::bigint::text, 12, '0')                                    AS f49_arrears_amount,

    -- Months in arrears
    CASE la.status::text WHEN 'IN_DEFAULT' THEN '01' ELSE '00' END
                                                                 AS f53_months_in_arrears,

    -- Consumer identity
    RPAD(COALESCE(p.identity_number, ''), 13, ' ')               AS f10_id_number,
    UPPER(COALESCE(p.gender, 'M'))                               AS f11_gender,
    REPLACE(COALESCE(p.date_of_birth::text, '00000000'), '-', '') AS f12_date_of_birth,

    -- Consumer name (last_name = surname, first_name = given names)
    RPAD(UPPER(COALESCE(p.last_name, '')), 30, ' ')              AS f06_surname,
    RPAD('MR', 5, ' ')                                           AS f08_title,
    RPAD(UPPER(COALESCE(p.first_name, '')), 30, ' ')             AS f07_first_names,
    RPAD('', 15, ' ')                                            AS f09_middle_names,

    -- Address (single line mapped to address_1; suburb to city)
    RPAD(COALESCE(p.address, ''), 30, ' ')                       AS f13_address_1,
    RPAD('', 30, ' ')                                            AS f14_address_2,
    RPAD(COALESCE(p.suburb_area, ''), 30, ' ')                   AS f15_city,
    RPAD('', 30, ' ')                                            AS f16_province,
    RPAD(COALESCE(p.postal_code, ''), 10, ' ')                   AS f17_postal,

    -- Employment (not held in profiles — blanked per spec allowance)
    RPAD('', 50, ' ')                                            AS f35_employer,
    RPAD('', 30, ' ')                                            AS f36_occupation,

    -- Contact
    RPAD(COALESCE(p.cell_tel_no, p.contact_number, ''), 15, ' ') AS f31_mobile,
    RPAD('', 15, ' ')                                            AS f32_work,

    -- Repayment start date
    COALESCE(TO_CHAR(la.repayment_start_date::date, 'YYYYMMDD'), '00000000')
                                                                 AS f46_first_payment_date

FROM public.loan_applications la
JOIN public.profiles p ON la.user_id = p.id
WHERE la.status::text NOT IN (
    'STARTED', 'BUREAU_CHECKING', 'BUREAU_OK',
    'BANK_LINKING', 'AFFORD_OK', 'OFFERED'
);
-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View v3 (Fix: cents → whole rands)
--
-- v2 multiplied amounts by 100 (cents) and used 12-digit fields.
-- Per SACRRA Layout 700v2 spec, financial fields are N9 = whole rands.
--
-- This corrects:
--   • Removes * 100 cents conversion
--   • Field width N12 → N9
--   • Wraps with ROUND() for clean integers
--
-- Run once in Supabase SQL Editor.
-- =====================================================================

CREATE OR REPLACE VIEW public.sacrra_700_view AS
SELECT
    la.id::text                                                  AS internal_id,
    'R'                                                          AS f01_record_type,

    RPAD(COALESCE(
        (SELECT provider_branch_code FROM public.system_settings LIMIT 1),
        'AL0001'
    ), 6, ' ')                                                   AS f02_supplier_ref,

    REPLACE(la.id::text, ' ', '')                                AS f40_account_number,

    CASE WHEN COALESCE(la.term_months, 1) = 1 THEN 'M' ELSE 'P' END  AS f03_account_type,

    CASE la.status::text
        WHEN 'DISBURSED'          THEN 'C'
        WHEN 'ACTIVE'             THEN 'C'
        WHEN 'DEBICHECK_AUTH'     THEN 'C'
        WHEN 'READY_TO_DISBURSE'  THEN 'C'
        WHEN 'OFFER_ACCEPTED'     THEN 'P'
        WHEN 'CONTRACT_SIGN'      THEN 'P'
        WHEN 'IN_DEFAULT'         THEN 'D'
        WHEN 'CLOSED'             THEN 'T'
        WHEN 'PAID_UP'            THEN 'T'
        WHEN 'REPAID'             THEN 'T'
        WHEN 'CANCELLED'          THEN 'V'
        WHEN 'REJECTED'           THEN 'V'
        WHEN 'DECLINED'           THEN 'V'
        WHEN 'BUREAU_DECLINE'     THEN 'V'
        ELSE 'L'
    END                                                          AS f50_status_code,

    TO_CHAR(COALESCE(la.updated_at, la.created_at), 'YYYYMMDD')  AS f51_status_date,
    TO_CHAR(la.created_at, 'YYYYMMDD')                           AS f43_date_opened,

    -- Financial fields — N9 whole rands per Layout 700v2 spec
    LPAD(ROUND(COALESCE(la.offer_principal, la.amount, 0))::bigint::text, 9, '0')
                                                                 AS f41_opening_balance,

    LPAD(ROUND(
        CASE la.status::text
            WHEN 'CLOSED'         THEN 0
            WHEN 'PAID_UP'        THEN 0
            WHEN 'REPAID'         THEN 0
            WHEN 'CANCELLED'      THEN 0
            WHEN 'REJECTED'       THEN 0
            WHEN 'DECLINED'       THEN 0
            WHEN 'BUREAU_DECLINE' THEN 0
            ELSE COALESCE(la.offer_total_repayment, la.offer_principal, la.amount, 0)
        END
    )::bigint::text, 9, '0')                                     AS f44_current_balance,

    LPAD(ROUND(COALESCE(la.offer_monthly_repayment, 0))::bigint::text, 9, '0')
                                                                 AS f45_installment,

    LPAD(ROUND(
        CASE la.status::text
            WHEN 'IN_DEFAULT' THEN COALESCE(la.offer_monthly_repayment, 0)
            ELSE 0
        END
    )::bigint::text, 9, '0')                                     AS f49_arrears_amount,

    CASE la.status::text WHEN 'IN_DEFAULT' THEN '01' ELSE '00' END  AS f53_months_in_arrears,

    RPAD(COALESCE(p.identity_number, ''), 13, ' ')               AS f10_id_number,
    COALESCE(p.gender, 'M')                                      AS f11_gender,
    TO_CHAR(COALESCE(p.date_of_birth, '1900-01-01'::date), 'YYYYMMDD') AS f12_date_of_birth,
    RPAD(COALESCE(p.last_name, p.full_name, ''), 25, ' ')        AS f06_surname,
    RPAD(COALESCE(p.first_name, ''), 14, ' ')                    AS f07_first_names,
    RPAD(COALESCE(p.address, ''), 25, ' ')                       AS f13_address_1,
    RPAD(COALESCE(p.suburb_area, ''), 25, ' ')                   AS f14_address_2,
    RPAD(COALESCE(p.suburb_area, ''), 25, ' ')                   AS f15_city,
    RPAD(COALESCE(p.suburb_area, ''), 25, ' ')                   AS f16_province,
    RPAD(COALESCE(p.postal_code, ''), 6, ' ')                    AS f17_postal,
    RPAD(COALESCE(p.cell_tel_no, p.contact_number, ''), 16, ' ') AS f31_mobile,
    RPAD('', 16, ' ')                                            AS f32_work,
    RPAD(COALESCE(la.employer_name, ''), 60, ' ')                AS f35_employer,
    LPAD(COALESCE(la.term_months, 1)::text, 4, '0')              AS f42_terms,
    TO_CHAR(la.created_at, 'YYYYMMDD')                           AS f46_first_payment_date

FROM public.loan_applications la
LEFT JOIN public.profiles p ON la.user_id = p.id
WHERE la.status::text IN (
    'DISBURSED','ACTIVE','DEBICHECK_AUTH','READY_TO_DISBURSE',
    'OFFER_ACCEPTED','CONTRACT_SIGN','IN_DEFAULT','IN_ARREARS',
    'CLOSED','PAID_UP','REPAID','CANCELLED','REJECTED','DECLINED','SETTLED'
);
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
-- TruID persistence table for banking collections and captured summary payloads.
-- Run this once in Supabase SQL editor.

create table if not exists public.truid_collections (
  id bigint generated by default as identity primary key,
  collection_id text not null unique,
  user_id uuid null references public.profiles(id) on delete set null,
  application_id text null,
  consent_id text null,
  consumer_url text null,
  status text null,
  normalized_status text null,
  verified boolean not null default false,
  correlation jsonb null,
  collection_payload jsonb null,
  summary_payload jsonb null,
  capture_attempts integer not null default 0,
  captured_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_truid_collections_user_id on public.truid_collections(user_id);
create index if not exists idx_truid_collections_status on public.truid_collections(status);
create index if not exists idx_truid_collections_updated_at on public.truid_collections(updated_at desc);

-- Optional: if RLS is enabled on this table, allow service role full access.
-- The app writes through SUPABASE_SERVICE_ROLE_KEY on the server.
alter table public.truid_collections enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'truid_collections'
      and policyname = 'service role full access on truid_collections'
  ) then
    create policy "service role full access on truid_collections."
      on public.truid_collections
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Optional extension: store full raw TruID products and extracted salary metadata.
-- Safe to run multiple times.
alter table public.truid_collections
  add column if not exists raw_payload jsonb null,
  add column if not exists income_payload jsonb null,
  add column if not exists transactions_payload jsonb null,
  add column if not exists salary_amount numeric(14,2) null,
  add column if not exists salary_date date null,
  add column if not exists salary_dates jsonb null;

create index if not exists idx_truid_collections_salary_date
  on public.truid_collections(salary_date);

create index if not exists idx_truid_collections_salary_amount
  on public.truid_collections(salary_amount);

create index if not exists idx_truid_collections_raw_payload_gin
  on public.truid_collections using gin (raw_payload);

create index if not exists idx_truid_collections_income_payload_gin
  on public.truid_collections using gin (income_payload);

create index if not exists idx_truid_collections_transactions_payload_gin
  on public.truid_collections using gin (transactions_payload);
