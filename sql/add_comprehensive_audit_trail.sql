-- Comprehensive Audit Trail System
-- Tracks all loan state changes, user actions, and financial movements

CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'loan', 'application', 'disbursement', 'user', 'system'
  entity_id BIGINT NOT NULL,
  action TEXT NOT NULL, -- 'created', 'updated', 'approved', 'declined', 'disbursed', etc.
  old_values JSONB NULL, -- previous values before change
  new_values JSONB NULL, -- new values after change
  changes_summary TEXT NULL, -- human-readable summary of changes
  metadata JSONB NULL, -- additional context (IP, user agent, location, etc.)
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_user_id_idx ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_type_idx ON public.audit_log(entity_type);
CREATE INDEX IF NOT EXISTS audit_log_entity_id_idx ON public.audit_log(entity_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log(created_at);

-- Loan state change tracking
CREATE TABLE IF NOT EXISTS public.loan_state_history (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  previous_balance NUMERIC(12, 2),
  new_balance NUMERIC(12, 2),
  previous_payment_date DATE,
  new_payment_date DATE,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loan_state_history_loan_id_idx ON public.loan_state_history(loan_id);
CREATE INDEX IF NOT EXISTS loan_state_history_user_id_idx ON public.loan_state_history(user_id);
CREATE INDEX IF NOT EXISTS loan_state_history_status_idx ON public.loan_state_history(new_status);
CREATE INDEX IF NOT EXISTS loan_state_history_created_at_idx ON public.loan_state_history(created_at);

-- User action tracking (approvals, overrides, approvals)
CREATE TABLE IF NOT EXISTS public.user_action_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'approval', 'decline', 'override', 'review', 'export', 'delete'
  target_type TEXT NOT NULL, -- 'application', 'loan', 'disbursement', 'report'
  target_id BIGINT NOT NULL,
  action_details JSONB,
  notes TEXT,
  approval_reason TEXT,
  decline_reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_action_log_user_id_idx ON public.user_action_log(user_id);
CREATE INDEX IF NOT EXISTS user_action_log_action_type_idx ON public.user_action_log(action_type);
CREATE INDEX IF NOT EXISTS user_action_log_target_type_idx ON public.user_action_log(target_type);
CREATE INDEX IF NOT EXISTS user_action_log_created_at_idx ON public.user_action_log(created_at);

-- Financial transaction tracking
CREATE TABLE IF NOT EXISTS public.financial_transaction_log (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'payment', 'fee', 'interest', 'default_charge', 'reversal'
  amount NUMERIC(12, 2) NOT NULL,
  balance_before NUMERIC(12, 2),
  balance_after NUMERIC(12, 2),
  reference_number TEXT,
  external_reference TEXT,
  status TEXT DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'reversed'
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS financial_transaction_log_loan_id_idx ON public.financial_transaction_log(loan_id);
CREATE INDEX IF NOT EXISTS financial_transaction_log_type_idx ON public.financial_transaction_log(transaction_type);
CREATE INDEX IF NOT EXISTS financial_transaction_log_created_at_idx ON public.financial_transaction_log(created_at);

-- Admin action tracking for compliance
CREATE TABLE IF NOT EXISTS public.admin_action_audit (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_category TEXT NOT NULL, -- 'application_management', 'loan_management', 'payout_management', 'system_config'
  action_description TEXT NOT NULL,
  affected_records JSONB, -- list of affected application/loan IDs
  risk_level TEXT DEFAULT 'low', -- 'low', 'medium', 'high'
  ip_address INET,
  session_id TEXT,
  approval_status TEXT, -- 'pending_review', 'approved', 'rejected'
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_action_audit_admin_id_idx ON public.admin_action_audit(admin_id);
CREATE INDEX IF NOT EXISTS admin_action_audit_category_idx ON public.admin_action_audit(action_category);
CREATE INDEX IF NOT EXISTS admin_action_audit_risk_level_idx ON public.admin_action_audit(risk_level);
CREATE INDEX IF NOT EXISTS admin_action_audit_created_at_idx ON public.admin_action_audit(created_at);

-- System events log (configuration changes, errors, etc.)
CREATE TABLE IF NOT EXISTS public.system_event_log (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'config_change', 'error', 'warning', 'integration_call', 'scheduled_task'
  severity TEXT DEFAULT 'info', -- 'debug', 'info', 'warning', 'error', 'critical'
  event_description TEXT NOT NULL,
  event_data JSONB,
  affected_users_count INT DEFAULT 0,
  resolution_status TEXT DEFAULT 'unresolved', -- 'unresolved', 'investigating', 'resolved'
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS system_event_log_type_idx ON public.system_event_log(event_type);
CREATE INDEX IF NOT EXISTS system_event_log_severity_idx ON public.system_event_log(severity);
CREATE INDEX IF NOT EXISTS system_event_log_created_at_idx ON public.system_event_log(created_at);

-- View for recent audit activity
CREATE OR REPLACE VIEW public.recent_audit_activity AS
SELECT
  'audit' as log_type,
  id,
  user_id,
  entity_type,
  action,
  created_at,
  entity_id
FROM public.audit_log
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'state_change' as log_type,
  id,
  user_id,
  'loan' as entity_type,
  new_status as action,
  created_at,
  loan_id as entity_id
FROM public.loan_state_history
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'user_action' as log_type,
  id,
  user_id,
  target_type as entity_type,
  action_type as action,
  created_at,
  target_id as entity_id
FROM public.user_action_log
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
