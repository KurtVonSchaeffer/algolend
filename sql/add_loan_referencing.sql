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
