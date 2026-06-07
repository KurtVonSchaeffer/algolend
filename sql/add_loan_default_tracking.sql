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
