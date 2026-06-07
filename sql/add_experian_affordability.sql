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
