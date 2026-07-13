-- Phase 4: Form 40 — persist staff count instead of a lost-on-reload
-- free-text field on the reporting screen.
--
-- ncr_statutory_registers already tracks most Form 40 figures (book value,
-- NPL, complaints, debt review referrals, submission tracking) via the
-- existing PUT /api/admin/ncr/statutory-registers/:year endpoint — but
-- staff_count and GET /api/compliance/form40 never pulled from it. This
-- adds the missing column; server.js wires the report endpoint to read it
-- and the PUT endpoint's field allowlist to accept writes to it.

ALTER TABLE public.ncr_statutory_registers
  ADD COLUMN IF NOT EXISTS staff_count INT NULL;

COMMENT ON COLUMN public.ncr_statutory_registers.staff_count IS
  'Number of staff at financial year end, for Form 40 Annual Financial & Operational Return. Previously a free-text field on the reporting screen that was never persisted.';
