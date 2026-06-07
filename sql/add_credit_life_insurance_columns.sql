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
