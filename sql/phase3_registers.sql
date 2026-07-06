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
