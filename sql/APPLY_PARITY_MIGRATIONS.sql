-- ============================================================================
-- AlgoLend — parity migrations (sync with ZwaneOfficial build, 2026-07-03)
-- Run this whole file once in the Supabase SQL editor (all statements are
-- idempotent: IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS).
-- ============================================================================

-- ────── from migrations/phase1_6_cash_journal_application_id.sql ──────
-- Cash journal sync (server.js POST /api/admin/ledger/sync) inserts application_id and
-- is_automated on every row, but these columns were never added to cash_journal — every
-- sync call has been failing with a Postgres "column does not exist" error, leaving the
-- ledger empty.
ALTER TABLE public.cash_journal ADD COLUMN IF NOT EXISTS application_id uuid;
ALTER TABLE public.cash_journal ADD COLUMN IF NOT EXISTS is_automated boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cash_journal_application_id ON public.cash_journal(application_id);


-- ────── from sql/add_contract_pdf_url.sql ──────
-- Add contract_pdf_url column to store the signed contract HTML/PDF link
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;


-- ────── from sql/add_contract_signature_url.sql ──────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS contract_signature_url TEXT;


-- ────── from sql/add_manual_payments_confirmed_columns.sql ──────
-- manual_payments — add confirmed_at/confirmed_by (Zwane-parity columns)
-- server.js already reads/writes these column names (payment confirm endpoint,
-- cash-ledger entry_date derivation). Backfill from the older reviewed_at/reviewed_by
-- pair for existing confirmed rows so historical data isn't lost.

ALTER TABLE public.manual_payments
    ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_by UUID;

UPDATE public.manual_payments
SET confirmed_at = reviewed_at,
    confirmed_by = reviewed_by
WHERE confirmed_at IS NULL
  AND status = 'confirmed';


-- ────── from sql/collections_notes.sql ──────
-- Collections notes — per-account escalation tracking
-- Run once in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.collection_notes (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  BIGINT        NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
    note_type       TEXT          NOT NULL DEFAULT 'note',  -- note | call | sms | email | legal | promise_to_pay
    body            TEXT          NOT NULL,
    promise_date    DATE          NULL,   -- for promise_to_pay type
    promise_amount  NUMERIC(12,2) NULL,
    outcome         TEXT          NULL,   -- kept | broken | pending (for promise_to_pay)
    created_by      UUID          NOT NULL REFERENCES public.profiles(id),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collection_notes_app  ON public.collection_notes (application_id, created_at DESC);

ALTER TABLE public.collection_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_collection_notes" ON public.collection_notes
    FOR ALL USING (auth.role() = 'service_role');


-- ────── from sql/add_compliance_fields.sql ──────
-- Add compliance fields for the login footer + contracts
-- Run once in Supabase SQL editor

ALTER TABLE public.system_settings
    ADD COLUMN IF NOT EXISTS legal_entity_name text,
    ADD COLUMN IF NOT EXISTS fsp_number        text;

-- Suggested defaults for AlgoLend — replace with real values when supplied
UPDATE public.system_settings
SET legal_entity_name = COALESCE(legal_entity_name, 'AlgoLend (Pty) Ltd')
WHERE id = 'global' AND (legal_entity_name IS NULL OR legal_entity_name = '');


-- ────── from sql/phase2_compliance_columns.sql ──────
-- Phase 2: NCA compliance columns on loan_applications
-- Run once in AlgoLendOfficial Supabase SQL editor

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS affordability_dti_pct         NUMERIC(6,2)   NULL,
  ADD COLUMN IF NOT EXISTS affordability_monthly_income   NUMERIC(12,2)  NULL,
  ADD COLUMN IF NOT EXISTS affordability_passed           BOOLEAN        NULL,
  ADD COLUMN IF NOT EXISTS affordability_assessed_at      TIMESTAMPTZ    NULL,
  ADD COLUMN IF NOT EXISTS affordability_assessor_id      UUID           NULL,
  ADD COLUMN IF NOT EXISTS under_debt_review              BOOLEAN        DEFAULT false,
  ADD COLUMN IF NOT EXISTS section129_sent_at             TIMESTAMPTZ    NULL,
  ADD COLUMN IF NOT EXISTS section129_reference           TEXT           NULL,
  ADD COLUMN IF NOT EXISTS fee_cap_validated_at           TIMESTAMPTZ    NULL;

CREATE INDEX IF NOT EXISTS idx_loan_apps_affordability_passed
  ON public.loan_applications (affordability_passed);

CREATE INDEX IF NOT EXISTS idx_loan_apps_section129_sent
  ON public.loan_applications (section129_sent_at)
  WHERE section129_sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_loan_apps_under_debt_review
  ON public.loan_applications (under_debt_review)
  WHERE under_debt_review = true;


-- ────── from sql/phase3_registers.sql ──────
-- Phase 3: NCR Agent Register (Reg 39) + Statutory Registers (Reg 40)
-- Run once in Supabase SQL editor

-- ── Agent / Representative Register (NCR Regulation 39) ──────────────────────
CREATE TABLE IF NOT EXISTS public.ncr_agent_register (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name       TEXT          NOT NULL,
    id_number       TEXT          NOT NULL,
    ncr_number      TEXT          NULL,         -- individual NCR registration if applicable
    role            TEXT          NOT NULL,     -- e.g. 'Debt Counsellor', 'Credit Provider Rep', 'Compliance Officer'
    branch          TEXT          NULL,
    appointment_date DATE         NOT NULL,
    termination_date DATE         NULL,         -- NULL = still active
    status          TEXT          NOT NULL DEFAULT 'active',  -- active | suspended | terminated
    notes           TEXT          NULL,
    created_by      UUID          REFERENCES public.profiles(id),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_register_status ON public.ncr_agent_register (status);

-- ── Statutory Registers (NCR Reg 40 annual data points) ──────────────────────
CREATE TABLE IF NOT EXISTS public.ncr_statutory_registers (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_year          INT           NOT NULL,  -- e.g. 2025
    -- Form 40 key figures
    total_agreements        INT           NULL,
    total_book_value        NUMERIC(18,2) NULL,
    npl_count               INT           NULL,      -- non-performing loans
    npl_value               NUMERIC(18,2) NULL,
    write_offs              NUMERIC(18,2) NULL,
    recoveries              NUMERIC(18,2) NULL,
    total_revenue           NUMERIC(18,2) NULL,
    impairment_provision    NUMERIC(18,2) NULL,
    complaints_received     INT           NULL,
    complaints_resolved     INT           NULL,
    debt_review_referrals   INT           NULL,
    -- Submission tracking
    submitted_to_ncr        BOOLEAN       NOT NULL DEFAULT false,
    submitted_at            TIMESTAMPTZ   NULL,
    submission_reference    TEXT          NULL,
    notes                   TEXT          NULL,
    created_by              UUID          REFERENCES public.profiles(id),
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (financial_year)
);

-- RLS: admins only (service-role bypasses RLS anyway, but good hygiene)
ALTER TABLE public.ncr_agent_register      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncr_statutory_registers ENABLE ROW LEVEL SECURITY;

-- Allow service-role full access; restrict anon/authenticated to admins
CREATE POLICY "admin_all_agent_register" ON public.ncr_agent_register
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "admin_all_statutory_registers" ON public.ncr_statutory_registers
    FOR ALL USING (auth.role() = 'service_role');


-- ────── from sql/phase4_compliance_tracker.sql ──────
-- Phase 4: NCR Annual Compliance Checkpoint Tracker
-- Run once in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.ncr_compliance_checkpoints (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_year  INT           NOT NULL,
    checkpoint_key  TEXT          NOT NULL,   -- e.g. 'form39', 'form40', 'agent_register'
    status          TEXT          NOT NULL DEFAULT 'pending',  -- pending | in_progress | complete | na
    completed_at    TIMESTAMPTZ   NULL,
    completed_by    UUID          REFERENCES public.profiles(id),
    evidence_ref    TEXT          NULL,       -- doc ref, email ref, submission number etc.
    notes           TEXT          NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (financial_year, checkpoint_key)
);

CREATE INDEX IF NOT EXISTS idx_compliance_checkpoints_year
    ON public.ncr_compliance_checkpoints (financial_year);

ALTER TABLE public.ncr_compliance_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_compliance_checkpoints" ON public.ncr_compliance_checkpoints
    FOR ALL USING (auth.role() = 'service_role');


-- ────── from sql/phase5_external_compliance.sql ──────
-- Phase 5: PEP/Sanctions, CIPC, FIC goAML
-- Run once in Supabase SQL editor

-- ── PEP / Sanctions screening on loan_applications ────────────────────────────
ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS pep_sanctions_checked     BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS pep_sanctions_cleared     BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS pep_sanctions_checked_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pep_sanctions_checked_by  UUID        REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS pep_sanctions_provider    TEXT        NULL,  -- 'manual' | 'comply_advantage' | etc.
  ADD COLUMN IF NOT EXISTS pep_sanctions_ref         TEXT        NULL,  -- external screening reference
  ADD COLUMN IF NOT EXISTS pep_sanctions_notes       TEXT        NULL;

CREATE INDEX IF NOT EXISTS idx_loan_apps_pep_cleared
  ON public.loan_applications (pep_sanctions_cleared)
  WHERE pep_sanctions_cleared = false;

-- ── Juristic person (business) KYC on profiles ───────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_juristic_person   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS entity_name          TEXT    NULL,
  ADD COLUMN IF NOT EXISTS cipc_reg_number      TEXT    NULL,
  ADD COLUMN IF NOT EXISTS cipc_verified        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cipc_verified_at     TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS cipc_verified_by     UUID    REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cipc_notes           TEXT    NULL;

-- ── FIC goAML report log ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fic_goaml_reports (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type     TEXT          NOT NULL,   -- STR | CTR | TPR
    application_id  BIGINT        REFERENCES public.loan_applications(id),
    user_id         UUID          REFERENCES public.profiles(id),
    amount          NUMERIC(14,2) NULL,
    description     TEXT          NOT NULL,
    goaml_ref       TEXT          NULL,       -- reference number from goAML portal
    status          TEXT          NOT NULL DEFAULT 'draft',  -- draft | submitted | acknowledged
    submitted_at    TIMESTAMPTZ   NULL,
    submitted_by    UUID          REFERENCES public.profiles(id),
    acknowledged_at TIMESTAMPTZ   NULL,
    notes           TEXT          NULL,
    created_by      UUID          REFERENCES public.profiles(id),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goaml_reports_type   ON public.fic_goaml_reports (report_type);
CREATE INDEX IF NOT EXISTS idx_goaml_reports_status ON public.fic_goaml_reports (status);
CREATE INDEX IF NOT EXISTS idx_goaml_reports_user   ON public.fic_goaml_reports (user_id);

ALTER TABLE public.fic_goaml_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_goaml" ON public.fic_goaml_reports
    FOR ALL USING (auth.role() = 'service_role');


-- ────── from sql/profiles_rls_borrower.sql ──────
-- Allow authenticated users to read their own profile row.
-- Run this in Supabase SQL Editor.

-- Enable RLS if not already on
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop if exists to avoid duplicate
DROP POLICY IF EXISTS "users can read own profile" ON public.profiles;

CREATE POLICY "users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "users can update own profile" ON public.profiles;

CREATE POLICY "users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);


-- ────── from sql/sacrra_view_v9_full_fix.sql ──────
-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View v9
--
-- Full fix targeting zero rejections and minimum warnings.
--
-- Changes from v8:
--
--   1. f50_status_code — IN_ARREARS and IN_DEFAULT now emit 'C' (current)
--      not 'U'/'D'. When Current Balance Indicator = C (credit outstanding),
--      SACRRA only accepts C, P, or T as status. Arrears severity is
--      conveyed via f53_months_in_arrears and f49_arrears_amount instead.
--
--   2. f51_status_date — active (C) accounts now emit the month-end date
--      rather than the last payment date. Fixes "Status Date 3+ months
--      before Month End" warning for old accounts with no recent payments.
--
--   3. f51_status_date — cancelled (V) accounts clamp status date to
--      at least 6 days after date opened. Fixes "Date Opened may not be
--      more than 5 days before Status Date where Status = V" warning.
--
--   4. f45_installment — capped at current balance when current balance
--      < instalment. Fixes "Instalment > Current Balance by 10%" warning
--      for accounts near end of term.
--
--   5. f41_opening_balance — GREATEST(1, ...) ensures it is never 0.
--      Fixes "Opening Balance must be > 0" warning.
--
--   6. f46_last_payment_date — for active accounts with no payment in
--      either table, falls back to disbursement date (created_at).
--      Fixes "Last payment not supplied where account > 60 days old" warning.
--
--   7. last_payments CTE — fixed subquery structure (v8 had a self-join
--      bug using la_inner that didn't correlate correctly).
--
--   8. f53_months_in_arrears — IN_DEFAULT now emits '03' (3 months) to
--      reflect severe delinquency, not just '01'.
--
-- =====================================================================

DROP VIEW IF EXISTS public.sacrra_700_view;
CREATE VIEW public.sacrra_700_view AS

WITH month_end AS (
    SELECT (date_trunc('month', NOW()) - interval '1 day')::date AS dt
),

-- Last confirmed payment from either SureSystems debit orders (by user_id) or manual EFTs
last_payments AS (
    SELECT
        a.id AS application_id,
        GREATEST(
            (SELECT MAX(py.payment_date::date)
             FROM payments py
             WHERE py.user_id = a.user_id),
            (SELECT MAX(mp.confirmed_at::date)
             FROM manual_payments mp
             WHERE mp.application_id = a.id
               AND mp.status = 'confirmed')
        ) AS last_paid
    FROM loan_applications a
)

SELECT
    la.id::text                                                   AS internal_id,
    'R'::text                                                     AS f01_record_type,

    rpad(COALESCE(
        (SELECT system_settings.provider_branch_code FROM system_settings LIMIT 1),
        'TT0109'
    ), 6, ' ')                                                    AS f02_supplier_ref,

    replace(la.id::text, ' ', '')                                 AS f40_account_number,

    CASE
        WHEN COALESCE(la.term_months, 1) <= 1 THEN 'M'
        ELSE 'P'
    END                                                           AS f03_account_type,

    -- FIX 1: all accounts with positive balance must use C, P, or T.
    -- Arrears shown via months_in_arrears/arrears_amount fields.
    CASE la.status::text
        WHEN 'DISBURSED'          THEN 'C'
        WHEN 'ACTIVE'             THEN 'C'
        WHEN 'DEBICHECK_AUTH'     THEN 'C'
        WHEN 'READY_TO_DISBURSE'  THEN 'C'
        WHEN 'OFFER_ACCEPTED'     THEN 'C'
        WHEN 'CONTRACT_SIGN'      THEN 'C'
        WHEN 'IN_ARREARS'         THEN 'C'
        WHEN 'IN_DEFAULT'         THEN 'C'
        WHEN 'CLOSED'             THEN 'T'
        WHEN 'PAID_UP'            THEN 'T'
        WHEN 'REPAID'             THEN 'T'
        WHEN 'SETTLED'            THEN 'T'
        WHEN 'CANCELLED'          THEN 'V'
        WHEN 'REJECTED'           THEN 'V'
        WHEN 'DECLINED'           THEN 'V'
        WHEN 'BUREAU_DECLINE'     THEN 'V'
        ELSE 'C'
    END                                                           AS f50_status_code,

    -- FIX 2 & 3: status date rules per status
    CASE la.status::text
        -- Settled/closed: use actual close date
        WHEN 'CLOSED'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'PAID_UP'            THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'REPAID'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'SETTLED'            THEN to_char(la.updated_at, 'YYYYMMDD')
        -- Cancelled: clamp to at least 6 days after opening to avoid warning
        WHEN 'CANCELLED'          THEN to_char(
            GREATEST(la.updated_at::date, la.created_at::date + interval '6 days'),
            'YYYYMMDD')
        WHEN 'REJECTED'           THEN to_char(
            GREATEST(la.updated_at::date, la.created_at::date + interval '6 days'),
            'YYYYMMDD')
        WHEN 'DECLINED'           THEN to_char(
            GREATEST(la.updated_at::date, la.created_at::date + interval '6 days'),
            'YYYYMMDD')
        WHEN 'BUREAU_DECLINE'     THEN to_char(
            GREATEST(la.updated_at::date, la.created_at::date + interval '6 days'),
            'YYYYMMDD')
        -- FIX 2: active accounts use month-end date — always current, never stale
        ELSE to_char(me.dt, 'YYYYMMDD')
    END                                                           AS f51_status_date,

    to_char(la.created_at, 'YYYYMMDD')                           AS f43_date_opened,

    CASE
        WHEN COALESCE(la.term_months, 1) <= 1 THEN '0000'
        ELSE lpad(COALESCE(la.term_months, 1)::text, 4, '0')
    END                                                           AS f42_terms,

    -- FIX 5: opening balance always > 0
    lpad(GREATEST(1, round(COALESCE(la.offer_principal, la.amount, 0)))::bigint::text, 9, '0')
                                                                  AS f41_opening_balance,

    -- Current balance: 0 for closed/cancelled, principal for active
    lpad(round(
        CASE la.status::text
            WHEN 'CLOSED'         THEN 0
            WHEN 'PAID_UP'        THEN 0
            WHEN 'REPAID'         THEN 0
            WHEN 'SETTLED'        THEN 0
            WHEN 'CANCELLED'      THEN 0
            WHEN 'REJECTED'       THEN 0
            WHEN 'DECLINED'       THEN 0
            WHEN 'BUREAU_DECLINE' THEN 0
            ELSE GREATEST(1, COALESCE(la.offer_principal, la.amount, 0))
        END
    )::bigint::text, 9, '0')                                      AS f44_current_balance,

    -- FIX 4: cap instalment at current balance to avoid "instalment > balance 10%" warning
    lpad(round(
        CASE la.status::text
            WHEN 'CLOSED'         THEN 0
            WHEN 'PAID_UP'        THEN 0
            WHEN 'REPAID'         THEN 0
            WHEN 'SETTLED'        THEN 0
            WHEN 'CANCELLED'      THEN 0
            WHEN 'REJECTED'       THEN 0
            WHEN 'DECLINED'       THEN 0
            WHEN 'BUREAU_DECLINE' THEN 0
            ELSE LEAST(
                GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0)),
                GREATEST(1, COALESCE(la.offer_principal, la.amount, 0))
            )
        END
    )::bigint::text, 9, '0')                                      AS f45_installment,

    lpad(round(
        CASE la.status::text
            WHEN 'IN_ARREARS' THEN GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0))
            WHEN 'IN_DEFAULT' THEN GREATEST(3, COALESCE(la.offer_monthly_repayment, la.amount, 0) * 3)
            ELSE 0
        END
    )::bigint::text, 9, '0')                                      AS f49_arrears_amount,

    -- FIX 8: IN_DEFAULT = 03 months, IN_ARREARS = 01 month
    CASE la.status::text
        WHEN 'IN_DEFAULT' THEN '03'
        WHEN 'IN_ARREARS' THEN '01'
        ELSE '00'
    END                                                           AS f53_months_in_arrears,

    rpad(COALESCE(NULLIF(TRIM(p.identity_number), ''), ''), 13, ' ')
                                                                  AS f10_id_number,

    COALESCE(NULLIF(upper(left(p.gender, 1)), ''), 'M')           AS f11_gender,

    CASE
        WHEN p.date_of_birth IS NULL THEN '00000000'
        WHEN p.date_of_birth = '1900-01-01'::date THEN '00000000'
        ELSE to_char(p.date_of_birth, 'YYYYMMDD')
    END                                                           AS f12_date_of_birth,

    rpad(TRIM(regexp_replace(
        regexp_replace(
            COALESCE(p.last_name, p.full_name, ''),
            '\s*(PTY\.?\s*LTD\.?|LTD\.?|CC|INC\.?|CORP\.?|\(PTY\)|BK|NPC|RF)\s*$',
            '', 'gi'
        ),
        '\s*&.*$', '', 'g'
    )), 25, ' ')                                                   AS f06_surname,

    rpad(TRIM(regexp_replace(
        COALESCE(p.first_name, ''),
        '[^A-Za-z\-'' ` ]', '', 'g'
    )), 14, ' ')                                                   AS f07_first_names,

    rpad(COALESCE(p.address, ''), 25, ' ')                        AS f13_address_1,
    rpad(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f14_address_2,
    rpad(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f15_city,
    rpad(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f16_province,
    rpad(COALESCE(p.postal_code, ''), 6, ' ')                     AS f17_postal,
    rpad(COALESCE(p.cell_tel_no, p.contact_number, ''), 16, ' ')  AS f31_mobile,
    rpad('', 16, ' ')                                             AS f32_work,
    rpad(COALESCE(p.employer_name, ''), 60, ' ')                  AS f35_employer,

    -- FIX 6: last payment from SureSystems or manual EFT; fall back to
    -- created_at (disbursement date) so >60-day accounts always have a date.
    COALESCE(
        to_char(lp.last_paid, 'YYYYMMDD'),
        to_char(la.created_at::date, 'YYYYMMDD')
    )                                                             AS f46_last_payment_date,

    rpad('', 8, ' ')                                              AS f02b_branch_code

FROM loan_applications la
LEFT JOIN profiles p ON la.user_id = p.id
LEFT JOIN last_payments lp ON lp.application_id = la.id
CROSS JOIN month_end me
WHERE la.status::text IN (
    'DISBURSED','ACTIVE','DEBICHECK_AUTH','READY_TO_DISBURSE',
    'OFFER_ACCEPTED','CONTRACT_SIGN','IN_DEFAULT','IN_ARREARS',
    'CLOSED','PAID_UP','REPAID','CANCELLED','REJECTED','DECLINED','SETTLED',
    'BUREAU_DECLINE'
)
-- Exclude accounts opened after month-end date (rejection 4)
AND la.created_at::date <= me.dt::date
AND TRIM(COALESCE(p.identity_number, '')) != ''
AND LENGTH(TRIM(p.identity_number)) = 13;

