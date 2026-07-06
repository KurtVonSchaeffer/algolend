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
