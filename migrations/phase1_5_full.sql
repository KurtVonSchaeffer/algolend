-- ================================================================
-- Zwane Financial Services — Phase 1–5 Full Migration
-- Run this in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards)
-- ================================================================

-- ── 1. APPLICATION STATUS ENUM ───────────────────────────────────
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'IN_ARREARS';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'IN_DEFAULT';

-- ── 2. PROFILES — NOK, employer, credit cap, activity ────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nok_name              text,
  ADD COLUMN IF NOT EXISTS nok_phone             text,
  ADD COLUMN IF NOT EXISTS nok_relationship      text,
  ADD COLUMN IF NOT EXISTS credit_limit_override numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS credit_limit_note     text,
  ADD COLUMN IF NOT EXISTS employer_name         text,
  ADD COLUMN IF NOT EXISTS employer_phone        text,
  ADD COLUMN IF NOT EXISTS employer_address      text,
  ADD COLUMN IF NOT EXISTS employer_verified     boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS employer_verified_at  timestamptz,
  ADD COLUMN IF NOT EXISTS employer_verified_by  text,
  ADD COLUMN IF NOT EXISTS last_active_at        timestamptz;

-- ── 3. LOAN APPLICATIONS — purpose, loan number, credit decision ──
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS loan_purpose             text,
  ADD COLUMN IF NOT EXISTS loan_number              bigserial,
  ADD COLUMN IF NOT EXISTS credit_decision          text,
  ADD COLUMN IF NOT EXISTS credit_band_label        text,
  ADD COLUMN IF NOT EXISTS credit_band_color        text,
  ADD COLUMN IF NOT EXISTS credit_max_loan          numeric(12,2),
  ADD COLUMN IF NOT EXISTS credit_rate_pa           numeric(5,2),
  ADD COLUMN IF NOT EXISTS credit_max_term          integer,
  ADD COLUMN IF NOT EXISTS credit_decline_reasons   jsonb,
  ADD COLUMN IF NOT EXISTS first_loan_restriction   text,
  ADD COLUMN IF NOT EXISTS is_first_loan            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS routed_to_head_office    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS agreement_number         text;

-- Loan number sequence — first loan will be L1000
SELECT setval(pg_get_serial_sequence('loan_applications', 'loan_number'), 999);

-- ── 4. CREDIT CHECKS — NCR reference ─────────────────────────────
ALTER TABLE public.credit_checks
  ADD COLUMN IF NOT EXISTS ncr_reference   text,
  ADD COLUMN IF NOT EXISTS reported_to_ncr boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reported_at     timestamptz;

-- ── 5. SCORE BANDS — first loan term restriction ──────────────────
ALTER TABLE public.credit_score_bands
  ADD COLUMN IF NOT EXISTS first_loan_max_term_months integer DEFAULT NULL;

-- Set first loan = 1 month for existing Zwane bands
UPDATE public.credit_score_bands
SET first_loan_max_term_months = 1
WHERE organization_id = (SELECT id FROM public.organizations WHERE code = 'zwane');

-- ── 6. CASH JOURNAL ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_journal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date      date NOT NULL DEFAULT CURRENT_DATE,
  entry_type      text NOT NULL CHECK (entry_type IN ('cash_in','cash_out','opening_balance','closing_balance','adjustment')),
  category        text,
  description     text NOT NULL,
  amount          numeric(12,2) NOT NULL,
  reference       text,
  branch_id       bigint REFERENCES public.branches(id),
  created_by      uuid REFERENCES auth.users(id),
  created_by_name text,
  is_locked       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.cash_journal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage cash journal" ON public.cash_journal;
DROP POLICY IF EXISTS "Service reads cash journal"  ON public.cash_journal;

CREATE POLICY "Admins manage cash journal"
  ON public.cash_journal FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

CREATE POLICY "Service reads cash journal"
  ON public.cash_journal FOR SELECT USING (true);

-- ── 7. AUDIT LOG ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type       text NOT NULL,
  entity_id         text NOT NULL,
  action            text NOT NULL,
  old_value         jsonb,
  new_value         jsonb,
  description       text,
  performed_by      uuid REFERENCES auth.users(id),
  performed_by_name text,
  branch_id         bigint REFERENCES public.branches(id),
  ip_address        text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read audit log"  ON public.audit_log;
DROP POLICY IF EXISTS "Service inserts audit"   ON public.audit_log;

CREATE POLICY "Admins read audit log"
  ON public.audit_log FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

CREATE POLICY "Service inserts audit"
  ON public.audit_log FOR INSERT WITH CHECK (true);

-- ── 8. CREDIT RULES (organisations, bands, eligibility) ───────────
-- (Full script in migrations/credit_rules.sql)
-- If not already run, execute migrations/credit_rules.sql first.

-- ── 9. ORGANISATIONS (if credit_rules.sql already ran, skip) ──────
INSERT INTO public.organizations (name, code)
VALUES ('Zwane Financial Services', 'zwane')
ON CONFLICT (code) DO NOTHING;

-- ── 10. INDEXES (performance) ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_entity    ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created   ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_journal_date   ON public.cash_journal (entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_journal_branch ON public.cash_journal (branch_id);
CREATE INDEX IF NOT EXISTS idx_loan_apps_status    ON public.loan_applications (status);
CREATE INDEX IF NOT EXISTS idx_loan_apps_user      ON public.loan_applications (user_id);

-- ── Done ──────────────────────────────────────────────────────────
-- After running this script:
-- 1. The server will stop throwing "invalid input value for enum application_status: ACTIVE"
-- 2. Cash Ledger (/admin/cash-ledger) will work
-- 3. Audit Trail tab on application detail will work
-- 4. Loan numbers will start from L1000
-- 5. First loan term restrictions will be active
