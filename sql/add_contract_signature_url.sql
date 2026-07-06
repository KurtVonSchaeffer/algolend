ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS contract_signature_url TEXT;
