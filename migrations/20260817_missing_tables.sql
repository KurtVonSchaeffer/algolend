-- Migration: create all tables referenced in server.js that are missing from the live DB
-- 21 tables + 4 columns added to existing `loans` table
-- All CREATE TABLE IF NOT EXISTS — safe to re-run.
-- Run against project zpaqzzheqtrufemhpijn

-- ── 1. organizations ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    ncr_number  text NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_organizations" ON public.organizations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed a default org so credit_score_bands / affordability queries work immediately
INSERT INTO public.organizations (id, name, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'AlgoLend Financial', true)
ON CONFLICT (id) DO NOTHING;

-- ── 2. system_settings ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_settings (
    id                          text PRIMARY KEY DEFAULT 'global',
    company_name                text NULL,
    primary_color               text NULL,
    secondary_color             text NULL,
    tertiary_color              text NULL,
    theme_mode                  text NULL DEFAULT 'light',
    company_logo_url            text NULL,
    auth_background_url         text NULL,
    auth_background_flip        boolean NOT NULL DEFAULT false,
    auth_overlay_color          text NULL,
    auth_overlay_enabled        boolean NOT NULL DEFAULT true,
    carousel_slides             jsonb NULL,
    -- Banking details (shown on payment instruction screens)
    company_bank_name           text NULL,
    company_bank_account_no     text NULL,
    company_bank_branch_code    text NULL,
    company_bank_account_type   text NULL,
    company_bank_account_holder text NULL,
    company_bank_reference_prefix text NULL,
    -- Regulatory
    ncr_number                  text NULL,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_system_settings" ON public.system_settings
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed the global row so loadSystemSettings() returns sane defaults immediately
INSERT INTO public.system_settings (id, company_name, primary_color, theme_mode)
VALUES ('global', 'AlgoLend Financial', '#E7762E', 'light')
ON CONFLICT (id) DO NOTHING;

-- ── 3. bank_accounts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_name      text NULL,
    account_holder text NULL,
    account_number text NOT NULL,
    branch_code    text NULL,
    account_type   text NOT NULL DEFAULT 'cheque',
    is_verified    boolean NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_bank_accounts" ON public.bank_accounts
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "users_own_bank_accounts" ON public.bank_accounts
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON public.bank_accounts(user_id);

-- ── 4. financial_profiles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.financial_profiles (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                  uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_income           numeric(12,2) NULL,
    monthly_expenses         numeric(12,2) NULL,
    monthly_debt_repayments  numeric(12,2) NULL,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_financial_profiles" ON public.financial_profiles
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "users_own_financial_profile" ON public.financial_profiles
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── 5. credit_checks ─────────────────────────────────────────────────────────
-- External bureau credit check records (Experian etc.)
CREATE TABLE IF NOT EXISTS public.credit_checks (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credit_score integer NULL,
    status       text NOT NULL DEFAULT 'pending',  -- pending | completed | failed
    checked_at   timestamptz NULL,
    raw_response jsonb NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_credit_checks" ON public.credit_checks
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "users_own_credit_checks" ON public.credit_checks
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_credit_checks_user_status ON public.credit_checks(user_id, status, checked_at DESC);

-- ── 6. credit_score_bands ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_score_bands (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    label                   text NULL,
    min_score               integer NOT NULL DEFAULT 0,
    max_score               integer NOT NULL DEFAULT 850,
    interest_rate_pa        numeric(8,4) NULL,
    max_term_months         integer NULL,
    first_loan_max_term_months integer NULL,
    risk_level              text NOT NULL DEFAULT 'review',  -- approved | review | declined
    color                   text NULL,
    is_active               boolean NOT NULL DEFAULT true,
    sort_order              integer NOT NULL DEFAULT 0,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_score_bands ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_credit_score_bands" ON public.credit_score_bands
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_credit_score_bands_org_active ON public.credit_score_bands(organization_id, is_active, sort_order);

-- Seed sensible NCA-compliant bands (linked to the default org)
INSERT INTO public.credit_score_bands (organization_id, label, min_score, max_score, interest_rate_pa, max_term_months, first_loan_max_term_months, risk_level, color, sort_order)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Excellent',     767, 850, 21.00, 60, 12, 'approved', '#22c55e', 1),
    ('00000000-0000-0000-0000-000000000001', 'Good',          681, 766, 24.00, 48, 12, 'approved', '#84cc16', 2),
    ('00000000-0000-0000-0000-000000000001', 'Fair',          614, 680, 27.00, 36, 12, 'approved', '#eab308', 3),
    ('00000000-0000-0000-0000-000000000001', 'Average',       583, 613, 29.00, 24,  6, 'review',   '#f97316', 4),
    ('00000000-0000-0000-0000-000000000001', 'Below Average', 527, 582, 29.50, 12,  3, 'review',   '#ef4444', 5),
    ('00000000-0000-0000-0000-000000000001', 'Poor',            0, 526,  NULL,  NULL, NULL, 'declined', '#991b1b', 6)
ON CONFLICT DO NOTHING;

-- ── 7. credit_eligibility_rules ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_eligibility_rules (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rule_key        text NOT NULL,  -- e.g. min_credit_score, max_debt_to_income_pct
    label           text NULL,
    operator        text NOT NULL DEFAULT '>=',  -- >=, <=, ==, !=
    value           numeric NULL,
    is_active       boolean NOT NULL DEFAULT true,
    sort_order      integer NOT NULL DEFAULT 0,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_eligibility_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_credit_eligibility_rules" ON public.credit_eligibility_rules
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_credit_eligibility_rules_org ON public.credit_eligibility_rules(organization_id, is_active, sort_order);

-- Seed NCA-mandated minimum eligibility rules
INSERT INTO public.credit_eligibility_rules (organization_id, rule_key, label, operator, value, sort_order)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'min_credit_score',       'Minimum credit score',          '>=', 527,  1),
    ('00000000-0000-0000-0000-000000000001', 'min_monthly_income',     'Minimum monthly income (R)',     '>=', 3000, 2),
    ('00000000-0000-0000-0000-000000000001', 'max_debt_to_income_pct', 'Maximum debt-to-income ratio %', '<=', 75,   3),
    ('00000000-0000-0000-0000-000000000001', 'min_age',                'Minimum age (years)',            '>=', 18,   4),
    ('00000000-0000-0000-0000-000000000001', 'max_age',                'Maximum age (years)',            '<=', 65,   5)
ON CONFLICT DO NOTHING;

-- ── 8. payments (SureSystems debit order payments) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id uuid NULL REFERENCES public.loan_applications(id) ON DELETE SET NULL,
    payment_date   date NULL,
    amount         numeric(12,2) NOT NULL,
    reference      text NULL,
    status         text NOT NULL DEFAULT 'confirmed',
    source         text NULL DEFAULT 'suresystems',
    created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_payments" ON public.payments
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "users_own_payments" ON public.payments
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_application_id ON public.payments(application_id);

-- ── 9. repayments ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.repayments (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
    user_id        uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    amount         numeric(12,2) NOT NULL,
    status         text NOT NULL DEFAULT 'confirmed',  -- pending | confirmed | reversed
    payment_date   date NULL,
    reference      text NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.repayments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_repayments" ON public.repayments
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "users_own_repayments" ON public.repayments
    FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_repayments_application_id ON public.repayments(application_id, status);

-- ── 10. manual_payments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_payments (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    application_id uuid NULL REFERENCES public.loan_applications(id) ON DELETE SET NULL,
    loan_id        uuid NULL,
    payment_type   text NOT NULL DEFAULT 'repayment',  -- repayment | settlement | partial
    amount         numeric(12,2) NOT NULL,
    reference      text NULL,
    proof_url      text NULL,
    notes          text NULL,
    status         text NOT NULL DEFAULT 'pending',  -- pending | confirmed | rejected
    confirmed_by   uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    confirmed_at   timestamptz NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_manual_payments" ON public.manual_payments
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "users_own_manual_payments" ON public.manual_payments
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "users_insert_manual_payments" ON public.manual_payments
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_manual_payments_user_status ON public.manual_payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_manual_payments_application_id ON public.manual_payments(application_id);

-- ── 11. cash_journal ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_journal (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date      date NOT NULL,
    entry_type      text NOT NULL,    -- cash_in | cash_out
    category        text NULL,        -- repayment | disbursement | settlement | debit_order | fee
    description     text NULL,
    reference       text NULL,
    amount          numeric(12,2) NOT NULL DEFAULT 0,
    application_id  text NULL,        -- stored as text (uuid or legacy id)
    branch_id       text NULL,
    is_automated    boolean NOT NULL DEFAULT false,
    created_by_name text NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_journal ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_cash_journal" ON public.cash_journal
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_cash_journal_entry_date ON public.cash_journal(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_journal_application_id ON public.cash_journal(application_id) WHERE application_id IS NOT NULL;

-- ── 12. collection_notes ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collection_notes (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id uuid NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
    note_type      text NOT NULL DEFAULT 'note',  -- note | promise | call | email | legal
    body           text NOT NULL,
    promise_date   date NULL,
    promise_amount numeric(12,2) NULL,
    outcome        text NULL,
    created_by     uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collection_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_collection_notes" ON public.collection_notes
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_collection_notes_application_id ON public.collection_notes(application_id, created_at DESC);

-- ── 13. support_tickets ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject    text NOT NULL DEFAULT 'Support Request',
    category   text NULL DEFAULT 'general',
    message    text NOT NULL,
    priority   text NULL DEFAULT 'normal',  -- low | normal | high | urgent
    status     text NOT NULL DEFAULT 'open', -- open | in_progress | resolved | closed
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_support_tickets" ON public.support_tickets
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "users_own_support_tickets" ON public.support_tickets
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY IF NOT EXISTS "users_insert_support_tickets" ON public.support_tickets
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ── 14. push_subscriptions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint   text NOT NULL UNIQUE,
    keys       jsonb NULL,  -- { p256dh, auth }
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_push_subscriptions" ON public.push_subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "users_own_push_subscriptions" ON public.push_subscriptions
    FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 15. sacrra_bureaux ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sacrra_bureaux (
    bureau_key             text PRIMARY KEY,  -- 'experian' | 'transunion' | 'compuscan'
    name                   text NOT NULL,
    submission_method      text NOT NULL DEFAULT 'sftp',  -- sftp | moveit | api
    submission_host        text NULL,
    submission_port        integer NULL DEFAULT 22,
    submission_username    text NULL,
    submission_password    text NULL,   -- stored encrypted
    submission_path        text NULL,
    pgp_public_key         text NULL,
    is_enabled             boolean NOT NULL DEFAULT false,
    last_submitted_at      timestamptz NULL,
    last_submission_status text NULL,
    last_submission_note   text NULL,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sacrra_bureaux ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_sacrra_bureaux" ON public.sacrra_bureaux
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed the three SACRRA-registered SA credit bureaux
INSERT INTO public.sacrra_bureaux (bureau_key, name, submission_method, is_enabled)
VALUES
    ('experian',   'Experian South Africa',  'sftp',    false),
    ('transunion', 'TransUnion South Africa', 'sftp',   false),
    ('compuscan',  'Compuscan',               'moveit', false)
ON CONFLICT (bureau_key) DO NOTHING;

-- ── 16. sacrra_submissions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sacrra_submissions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bureau_key   text NULL REFERENCES public.sacrra_bureaux(bureau_key) ON DELETE SET NULL,
    file_name    text NOT NULL UNIQUE,
    status       text NOT NULL DEFAULT 'PENDING',  -- PENDING | TRANSMITTED | ACCEPTED | REJECTED
    record_count integer NULL,
    notes        text NULL,
    submitted_at timestamptz NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sacrra_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_sacrra_submissions" ON public.sacrra_submissions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 17. sacrra_rejections ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sacrra_rejections (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id    uuid NULL REFERENCES public.sacrra_submissions(id) ON DELETE SET NULL,
    match_key        text NOT NULL,
    error_code       text NOT NULL,
    error_description text NULL,
    raw_line         text NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    UNIQUE(match_key, error_code)
);

ALTER TABLE public.sacrra_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_sacrra_rejections" ON public.sacrra_rejections
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 18. fic_goaml_reports ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fic_goaml_reports (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    application_id uuid NULL REFERENCES public.loan_applications(id) ON DELETE SET NULL,
    report_type    text NOT NULL,  -- STR | CTR | TPR
    amount         numeric(12,2) NULL,
    description    text NOT NULL,
    goaml_ref      text NULL,
    status         text NOT NULL DEFAULT 'draft',  -- draft | submitted | acknowledged | rejected
    notes          text NULL,
    submitted_by   uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    submitted_at   timestamptz NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fic_goaml_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_fic_goaml_reports" ON public.fic_goaml_reports
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 19. ncr_agent_register ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ncr_agent_register (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name        text NOT NULL,
    id_number        text NOT NULL,
    ncr_number       text NULL,
    role             text NOT NULL,  -- debt_counsellor | credit_provider | agent | broker
    branch           text NULL,
    appointment_date date NOT NULL,
    termination_date date NULL,
    status           text NOT NULL DEFAULT 'active',  -- active | terminated
    notes            text NULL,
    created_by       uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ncr_agent_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_ncr_agent_register" ON public.ncr_agent_register
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 20. ncr_statutory_registers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ncr_statutory_registers (
    financial_year         integer PRIMARY KEY,
    total_agreements       integer NULL DEFAULT 0,
    total_book_value       numeric(16,2) NULL DEFAULT 0,
    npl_count              integer NULL DEFAULT 0,
    npl_value              numeric(16,2) NULL DEFAULT 0,
    write_offs             numeric(16,2) NULL DEFAULT 0,
    staff_count            integer NULL DEFAULT 0,
    complaints_received    integer NULL DEFAULT 0,
    complaints_resolved    integer NULL DEFAULT 0,
    debt_review_referrals  integer NULL DEFAULT 0,
    submitted_to_ncr       boolean NOT NULL DEFAULT false,
    submitted_at           timestamptz NULL,
    submission_reference   text NULL,
    notes                  text NULL,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ncr_statutory_registers ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_ncr_statutory_registers" ON public.ncr_statutory_registers
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 21. ncr_compliance_checkpoints ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ncr_compliance_checkpoints (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_year  integer NOT NULL,
    checkpoint_key  text NOT NULL,
    status          text NOT NULL DEFAULT 'pending',  -- pending | in_progress | complete | na
    completed_by    uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    completed_at    timestamptz NULL,
    notes           text NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE(financial_year, checkpoint_key)
);

ALTER TABLE public.ncr_compliance_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "service_role_full_ncr_compliance_checkpoints" ON public.ncr_compliance_checkpoints
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Patch loans table: add columns server.js expects ──────────────────────────
-- loans exists but uses different column names than server.js expects.
-- Adding alias columns and backfilling from existing data.
ALTER TABLE public.loans
    ADD COLUMN IF NOT EXISTS principal_amount   numeric(12,2) NULL,
    ADD COLUMN IF NOT EXISTS monthly_payment    numeric(12,2) NULL,
    ADD COLUMN IF NOT EXISTS start_date         date NULL,
    ADD COLUMN IF NOT EXISTS next_payment_date  date NULL;

-- Backfill from existing columns
UPDATE public.loans
SET
    principal_amount  = principal         WHERE principal_amount IS NULL AND principal IS NOT NULL;
UPDATE public.loans
SET
    monthly_payment   = monthly_installment WHERE monthly_payment IS NULL AND monthly_installment IS NOT NULL;
UPDATE public.loans
SET
    start_date        = disbursed_at::date  WHERE start_date IS NULL AND disbursed_at IS NOT NULL;
UPDATE public.loans
SET
    next_payment_date = first_due_date      WHERE next_payment_date IS NULL AND first_due_date IS NOT NULL;

-- ── Ensure ai_credit_score + ai_credit_band exist on loan_applications ────────
-- (Added in Phase 2 but may not be in migration file)
ALTER TABLE public.loan_applications
    ADD COLUMN IF NOT EXISTS ai_credit_score integer NULL,
    ADD COLUMN IF NOT EXISTS ai_credit_band  text NULL;

-- ── Performance indexes on new tables ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_manual_payments_status ON public.manual_payments(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_journal_entry_type ON public.cash_journal(entry_type, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_fic_goaml_reports_status ON public.fic_goaml_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ncr_agent_register_status ON public.ncr_agent_register(status, appointment_date);
CREATE INDEX IF NOT EXISTS idx_ncr_compliance_year_key ON public.ncr_compliance_checkpoints(financial_year, checkpoint_key);
