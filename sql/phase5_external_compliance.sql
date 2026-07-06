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
