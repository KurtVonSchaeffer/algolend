-- ============================================================================
-- AlgoLend — parity migrations round 2 (missed files: sacrra_bureaux, disbursements)
-- Run once in the Supabase SQL editor. Idempotent.
-- ============================================================================

-- ────── from sql/sacrra_bureaux.sql ──────
-- ════════════════════════════════════════════════════════════════
-- SACRRA Bureau Configuration
-- One row per bureau (Experian, TransUnion, XDS, Compuscan)
-- Run once in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sacrra_bureaux (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bureau_key          text UNIQUE NOT NULL,   -- 'experian' | 'transunion' | 'xds' | 'compuscan'
    bureau_name         text NOT NULL,           -- Display name
    is_enabled          boolean DEFAULT true,

    -- Identification (each bureau issues their own SRN)
    supplier_ref_number text,                    -- 10-char SRN issued by bureau
    pgp_public_key      text,                    -- Bureau's PGP public key for encryption

    -- Submission method
    submission_method   text NOT NULL DEFAULT 'email' CHECK (submission_method IN ('moveit','email','sftp')),
    submission_email    text,                    -- For 'email' method — where to send the .pgp file
    submission_host     text,                    -- For 'sftp' method
    submission_username text,
    submission_password text,                    -- Encrypted at rest by Supabase
    submission_folder   text,                    -- Upload folder ID/path

    -- Last submission tracking
    last_submitted_at   timestamptz,
    last_submission_status text,                 -- 'success' | 'failed' | 'pending'
    last_submission_note   text,

    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Seed the 4 bureaux (idempotent)
INSERT INTO public.sacrra_bureaux (bureau_key, bureau_name, submission_method, submission_email) VALUES
    ('experian',   'Experian',    'moveit', NULL),
    ('transunion', 'TransUnion',  'email',  NULL),
    ('xds',        'XDS',         'email',  NULL),
    ('compuscan', 'Compuscan',   'email',  NULL)
ON CONFLICT (bureau_key) DO NOTHING;

ALTER TABLE public.sacrra_bureaux ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.sacrra_bureaux;
CREATE POLICY "service_role_all" ON public.sacrra_bureaux FOR ALL USING (true);


-- ────── from sql/add_payout_disbursement.sql ──────
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

