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
