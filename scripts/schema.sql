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
