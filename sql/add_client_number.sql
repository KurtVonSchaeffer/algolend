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
