-- Performance indexes for AlgoLend at scale
-- Run once against your Supabase project via the SQL editor
-- All use IF NOT EXISTS so safe to re-run

-- loan_applications: most queried table (status filters, user lookups, date sorts)
CREATE INDEX IF NOT EXISTS idx_loan_apps_status      ON loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loan_apps_user_id     ON loan_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_apps_created_at  ON loan_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_apps_status_date ON loan_applications(status, created_at DESC);

-- loans: core portfolio table
CREATE INDEX IF NOT EXISTS idx_loans_status      ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_user_id     ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_created_at  ON loans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_status_date ON loans(status, created_at DESC);

-- manual_payments: high-volume, filtered by status constantly
CREATE INDEX IF NOT EXISTS idx_payments_status      ON manual_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id     ON manual_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at  ON manual_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status_date ON manual_payments(status, created_at DESC);

-- profiles: user lookups by role, email search
CREATE INDEX IF NOT EXISTS idx_profiles_role       ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);

-- credit_checks: latest score per user (analytics)
CREATE INDEX IF NOT EXISTS idx_credit_checks_user_id    ON credit_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_checks_checked_at ON credit_checks(checked_at DESC);

-- Optional tables — wrapped so a missing table skips cleanly without aborting the batch

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_mandates_user_id    ON debit_mandates(user_id);
  CREATE INDEX IF NOT EXISTS idx_mandates_created_at ON debit_mandates(created_at DESC);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_payouts_user_id    ON payouts(user_id);
  CREATE INDEX IF NOT EXISTS idx_payouts_status     ON payouts(status);
  CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at DESC);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_compliance_status   ON compliance_tasks(status);
  CREATE INDEX IF NOT EXISTS idx_compliance_due_date ON compliance_tasks(due_date);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_application_id ON audit_log(application_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created_at     ON audit_log(created_at DESC);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_goaml_type       ON goaml_reports(report_type);
  CREATE INDEX IF NOT EXISTS idx_goaml_created_at ON goaml_reports(created_at DESC);
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_cash_ledger_date ON cash_ledger(transaction_date DESC);
EXCEPTION WHEN others THEN NULL; END $$;
