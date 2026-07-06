-- Add contract_pdf_url column to store the signed contract HTML/PDF link
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;
