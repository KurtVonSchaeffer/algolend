-- Migration: loan_applications parity
-- The live table was created from the ZwaneOfficial schema (B2B/corporate lending).
-- server.js expects the AlgoLend consumer-lending schema.
-- This migration adds all missing columns — existing rows get null/false defaults.
-- All ADD COLUMN IF NOT EXISTS so safe to re-run.

-- ── Identity: user_id alias for client_id ─────────────────────────────────────
-- server.js queries .eq('user_id', userId) throughout; live schema has client_id.
-- Adding user_id as a separate nullable column; backfill from client_id below.
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS user_id uuid null references auth.users(id) on delete set null;

-- Backfill user_id from client_id for any existing rows
UPDATE public.loan_applications SET user_id = client_id WHERE user_id IS NULL AND client_id IS NOT NULL;

-- ── Loan identity ─────────────────────────────────────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS loan_number        text null,
  ADD COLUMN IF NOT EXISTS agreement_number   text null,
  ADD COLUMN IF NOT EXISTS source             text null,   -- 'PORTAL', 'PARTNER_API', etc.
  ADD COLUMN IF NOT EXISTS bank_account_id    uuid null,
  ADD COLUMN IF NOT EXISTS is_first_loan      boolean null,
  ADD COLUMN IF NOT EXISTS repayment_start_date date null;

-- ── Offer / pricing columns ───────────────────────────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS offer_principal              numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_monthly_repayment      numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_total_repayment        numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_total_interest         numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_total_initiation_fees  numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_total_admin_fees       numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_credit_life_monthly    numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_credit_life_total      numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_interest_rate          numeric(8,4)  null,
  ADD COLUMN IF NOT EXISTS offer_vat_amount             numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_total_cost_of_credit   numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS offer_details                jsonb         null;

-- ── Credit decision ───────────────────────────────────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS credit_decision        text    null,  -- 'approve'/'review'/'decline'
  ADD COLUMN IF NOT EXISTS credit_band_label      text    null,
  ADD COLUMN IF NOT EXISTS credit_band_color      text    null,
  ADD COLUMN IF NOT EXISTS credit_decline_reasons text[]  null,
  ADD COLUMN IF NOT EXISTS credit_max_loan        numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS credit_max_term        integer null,
  ADD COLUMN IF NOT EXISTS credit_rate_pa         numeric(8,4)  null,
  ADD COLUMN IF NOT EXISTS effective_max_term_months integer null,
  ADD COLUMN IF NOT EXISTS first_loan_restriction boolean null;

-- ── Affordability (NCA s80-81) ────────────────────────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS affordability_passed       boolean   null,
  ADD COLUMN IF NOT EXISTS affordability_assessed_at  timestamptz null,
  ADD COLUMN IF NOT EXISTS affordability_assessor_id  uuid      null,
  ADD COLUMN IF NOT EXISTS affordability_dti_pct      numeric(6,4) null,
  ADD COLUMN IF NOT EXISTS affordability_monthly_income numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS monthly_income             numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS monthly_debt_repayments    numeric(12,2) null;

-- ── Debt / default tracking ───────────────────────────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS under_debt_review      boolean     null default false,
  ADD COLUMN IF NOT EXISTS outstanding_balance    numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS total_in_arrears       numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS default_balance        numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS default_interest_rate  numeric(8,4) null,
  ADD COLUMN IF NOT EXISTS default_monthly_charge numeric(12,2) null,
  ADD COLUMN IF NOT EXISTS defaulted_at           timestamptz null;

-- ── PEP / Sanctions (FICA) ────────────────────────────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS pep_sanctions_cleared      boolean     null default false,
  ADD COLUMN IF NOT EXISTS pep_sanctions_checked      boolean     null default false,
  ADD COLUMN IF NOT EXISTS pep_sanctions_checked_at   timestamptz null,
  ADD COLUMN IF NOT EXISTS pep_sanctions_checked_by   uuid        null,
  ADD COLUMN IF NOT EXISTS pep_sanctions_notes        text        null,
  ADD COLUMN IF NOT EXISTS pep_sanctions_provider     text        null,
  ADD COLUMN IF NOT EXISTS pep_sanctions_ref          text        null;

-- ── KYC ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS kyc_status text null;

-- ── Contract / signing ────────────────────────────────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS contract_signed_at       timestamptz null,
  ADD COLUMN IF NOT EXISTS contract_signature_url   text        null,
  ADD COLUMN IF NOT EXISTS contract_pdf_url         text        null,
  ADD COLUMN IF NOT EXISTS fee_cap_validated_at     timestamptz null,
  ADD COLUMN IF NOT EXISTS debicheck_reference      text        null,
  ADD COLUMN IF NOT EXISTS contract_reference       text        null;

-- ── Section-129 ───────────────────────────────────────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS section129_sent_at    timestamptz null,
  ADD COLUMN IF NOT EXISTS section129_reference  text        null,
  ADD COLUMN IF NOT EXISTS created_by_name       text        null;

-- ── Index on user_id (now that it exists) ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loan_apps_user_id ON public.loan_applications(user_id) WHERE user_id IS NOT NULL;
