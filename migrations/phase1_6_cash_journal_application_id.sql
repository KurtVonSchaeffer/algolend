-- Cash journal sync (server.js POST /api/admin/ledger/sync) inserts application_id and
-- is_automated on every row, but these columns were never added to cash_journal — every
-- sync call has been failing with a Postgres "column does not exist" error, leaving the
-- ledger empty.
ALTER TABLE public.cash_journal ADD COLUMN IF NOT EXISTS application_id uuid;
ALTER TABLE public.cash_journal ADD COLUMN IF NOT EXISTS is_automated boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cash_journal_application_id ON public.cash_journal(application_id);
