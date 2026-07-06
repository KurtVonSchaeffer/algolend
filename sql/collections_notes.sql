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
