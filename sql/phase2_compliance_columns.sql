-- Phase 2: NCA compliance columns on loan_applications
-- Run once in AlgoLendOfficial Supabase SQL editor

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS affordability_dti_pct         NUMERIC(6,2)   NULL,
  ADD COLUMN IF NOT EXISTS affordability_monthly_income   NUMERIC(12,2)  NULL,
  ADD COLUMN IF NOT EXISTS affordability_passed           BOOLEAN        NULL,
  ADD COLUMN IF NOT EXISTS affordability_assessed_at      TIMESTAMPTZ    NULL,
  ADD COLUMN IF NOT EXISTS affordability_assessor_id      UUID           NULL,
  ADD COLUMN IF NOT EXISTS under_debt_review              BOOLEAN        DEFAULT false,
  ADD COLUMN IF NOT EXISTS section129_sent_at             TIMESTAMPTZ    NULL,
  ADD COLUMN IF NOT EXISTS section129_reference           TEXT           NULL,
  ADD COLUMN IF NOT EXISTS fee_cap_validated_at           TIMESTAMPTZ    NULL;

CREATE INDEX IF NOT EXISTS idx_loan_apps_affordability_passed
  ON public.loan_applications (affordability_passed);

CREATE INDEX IF NOT EXISTS idx_loan_apps_section129_sent
  ON public.loan_applications (section129_sent_at)
  WHERE section129_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_loan_apps_under_debt_review
  ON public.loan_applications (under_debt_review)
  WHERE under_debt_review = true;
