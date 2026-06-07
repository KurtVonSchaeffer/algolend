-- Payout and Disbursement System
-- Handles Capitec, CashSend, and other payment methods

-- Disbursement tracking
CREATE TABLE IF NOT EXISTS public.disbursements (
  id BIGSERIAL PRIMARY KEY,
  application_id BIGINT NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Disbursement details
  amount NUMERIC(12, 2) NOT NULL,
  disbursement_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, reversed

  -- Payout method
  payout_method TEXT NOT NULL, -- 'capitec', 'cashsend', 'third_party', 'cash'
  bank_account_id BIGINT REFERENCES public.bank_accounts(id) ON DELETE SET NULL,

  -- CashSend specifics
  cashsend_reference TEXT NULL,
  cashsend_fee NUMERIC(12, 2) DEFAULT 0,

  -- Third party (other than client)
  third_party_name TEXT NULL,
  third_party_account TEXT NULL,
  third_party_bank TEXT NULL,

  -- Capitec API integration
  capitec_batch_id TEXT NULL,
  capitec_transaction_id TEXT NULL,
  capitec_response JSONB NULL,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS disbursements_application_id_idx ON public.disbursements(application_id);
CREATE INDEX IF NOT EXISTS disbursements_user_id_idx ON public.disbursements(user_id);
CREATE INDEX IF NOT EXISTS disbursements_status_idx ON public.disbursements(status);
CREATE INDEX IF NOT EXISTS disbursements_payout_method_idx ON public.disbursements(payout_method);
CREATE INDEX IF NOT EXISTS disbursements_capitec_batch_id_idx ON public.disbursements(capitec_batch_id);

-- CashSend configuration & fee structure
CREATE TABLE IF NOT EXISTS public.cashsend_config (
  id BIGSERIAL PRIMARY KEY,
  base_fee NUMERIC(12, 2) NOT NULL DEFAULT 5.00,
  percentage_fee NUMERIC(5, 2) NOT NULL DEFAULT 2.50, -- % of amount
  min_amount NUMERIC(12, 2) NOT NULL DEFAULT 100,
  max_amount NUMERIC(12, 2) NOT NULL DEFAULT 50000,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Payout audit trail
CREATE TABLE IF NOT EXISTS public.payout_audit_log (
  id BIGSERIAL PRIMARY KEY,
  disbursement_id BIGINT NOT NULL REFERENCES public.disbursements(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'submitted', 'approved', 'sent', 'failed', 'reversed'
  details JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS payout_audit_log_disbursement_id_idx ON public.payout_audit_log(disbursement_id);
CREATE INDEX IF NOT EXISTS payout_audit_log_action_idx ON public.payout_audit_log(action);

-- CSV export tracking (locked after export)
CREATE TABLE IF NOT EXISTS public.payout_csv_exports (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL UNIQUE,
  method TEXT NOT NULL, -- 'capitec', 'cashsend', 'all'
  record_count INT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  status TEXT DEFAULT 'exported', -- exported, uploaded, archived
  csv_hash TEXT NOT NULL, -- SHA256 of CSV content for integrity
  locked BOOLEAN DEFAULT true, -- prevent further modifications
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS payout_csv_exports_batch_id_idx ON public.payout_csv_exports(batch_id);
CREATE INDEX IF NOT EXISTS payout_csv_exports_method_idx ON public.payout_csv_exports(method);

-- Update trigger for disbursements
CREATE OR REPLACE FUNCTION public.touch_disbursements_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_disbursements_updated_at ON public.disbursements;
CREATE TRIGGER trg_touch_disbursements_updated_at
BEFORE UPDATE ON public.disbursements
FOR EACH ROW
EXECUTE FUNCTION public.touch_disbursements_updated_at();

-- Default CashSend config (insert if not exists)
INSERT INTO public.cashsend_config (base_fee, percentage_fee)
VALUES (5.00, 2.50)
ON CONFLICT DO NOTHING;
