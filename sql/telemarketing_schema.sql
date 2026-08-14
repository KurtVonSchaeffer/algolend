-- =====================================================================
-- Telemarketing CRM + Commission/Payroll — schema v1
--
-- Feature: agents track calls + leads through a pipeline (Lead ->
-- Contacted -> Contract Signed -> Compliance Pending -> Compliance
-- Approved/Live -> [commission generated] | Rejected). Commission is a
-- ONE-TIME flat amount per signed client, based on the client's tier,
-- paid out in the payroll period (calendar month) that contains the
-- client's first debit-order deduction date.
--
-- Run this whole file in the Supabase SQL editor.
-- =====================================================================

-- ── Tiers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_tiers (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            text NOT NULL UNIQUE,
    commission_amount numeric(10,2) NOT NULL DEFAULT 0,
    sort_order      int NOT NULL DEFAULT 0,
    active          boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.client_tiers (name, commission_amount, sort_order)
VALUES
    ('Standard', 250.00, 1),
    ('Premium',  450.00, 2),
    ('Enterprise', 750.00, 3)
ON CONFLICT (name) DO NOTHING;

-- ── Agents ─────────────────────────────────────────────────────────────
-- One row per telemarketing agent, linked to their auth.users login.
CREATE TABLE IF NOT EXISTS public.telemarketing_agents (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name       text NOT NULL,
    email           text,
    phone           text,
    status          text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Leads / clients ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telemarketing_leads (
    id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agent_id                bigint NOT NULL REFERENCES public.telemarketing_agents(id) ON DELETE CASCADE,
    tier_id                 bigint REFERENCES public.client_tiers(id),
    loan_application_id     bigint REFERENCES public.loan_applications(id) ON DELETE SET NULL,

    client_name             text NOT NULL,
    contact_number          text,
    email                   text,

    status                  text NOT NULL DEFAULT 'LEAD' CHECK (status IN (
                                'LEAD', 'CONTACTED', 'CONTRACT_SIGNED',
                                'COMPLIANCE_PENDING', 'COMPLIANCE_APPROVED',
                                'REJECTED'
                            )),

    signed_document_url     text,
    signed_at               timestamptz,
    compliance_approved_at  timestamptz,
    compliance_approved_by  uuid REFERENCES auth.users(id),

    -- The date the client's FIRST debit-order deduction is scheduled/occurs.
    -- Drives which payroll period the agent's commission lands in.
    first_deduction_date    date,

    notes                   text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemarketing_leads_agent ON public.telemarketing_leads(agent_id);
CREATE INDEX IF NOT EXISTS idx_telemarketing_leads_status ON public.telemarketing_leads(status);

-- ── Commission ledger ────────────────────────────────────────────────────
-- One row per signed/approved client — generated once (application-side,
-- not a DB trigger, to match this app's existing pattern of business logic
-- living in server.js) when a lead flips to COMPLIANCE_APPROVED and has a
-- first_deduction_date set.
CREATE TABLE IF NOT EXISTS public.telemarketing_commissions (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lead_id         bigint NOT NULL UNIQUE REFERENCES public.telemarketing_leads(id) ON DELETE CASCADE,
    agent_id        bigint NOT NULL REFERENCES public.telemarketing_agents(id) ON DELETE CASCADE,
    tier_id         bigint REFERENCES public.client_tiers(id),

    amount          numeric(10,2) NOT NULL,

    -- Calendar month whose end-of-month payroll run pays this commission —
    -- always the month containing the client's first_deduction_date.
    payroll_period  date NOT NULL,

    status          text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID')),
    paid_at         timestamptz,

    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemarketing_commissions_agent ON public.telemarketing_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_telemarketing_commissions_period ON public.telemarketing_commissions(payroll_period);

-- ── Call log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telemarketing_calls (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    agent_id        bigint NOT NULL REFERENCES public.telemarketing_agents(id) ON DELETE CASCADE,
    lead_id         bigint REFERENCES public.telemarketing_leads(id) ON DELETE SET NULL,

    call_date       timestamptz NOT NULL DEFAULT now(),
    duration_seconds int,
    outcome         text CHECK (outcome IN (
                        'NO_ANSWER', 'INTERESTED', 'NOT_INTERESTED', 'CALLBACK', 'SIGNED'
                    )),
    notes           text,

    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemarketing_calls_agent ON public.telemarketing_calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_telemarketing_calls_lead ON public.telemarketing_calls(lead_id);

-- ── updated_at trigger for leads ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_telemarketing_leads_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_telemarketing_leads_updated_at ON public.telemarketing_leads;
CREATE TRIGGER trg_telemarketing_leads_updated_at
    BEFORE UPDATE ON public.telemarketing_leads
    FOR EACH ROW EXECUTE FUNCTION public.set_telemarketing_leads_updated_at();
