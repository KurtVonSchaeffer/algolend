-- Track Section 129 notices that were claimed but not delivered.
-- Ops query: WHERE section129_sent_at IS NOT NULL AND section129_send_failed = true
ALTER TABLE loan_applications
    ADD COLUMN IF NOT EXISTS section129_send_failed BOOLEAN NOT NULL DEFAULT FALSE;
