-- ================================================================
-- Credit Rules Engine — White-Label Per-Client Configuration
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Organizations (white-label lender clients)
CREATE TABLE IF NOT EXISTS public.organizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  code          text UNIQUE NOT NULL,  -- slug, e.g. 'zwane', 'mintlend'
  is_active     boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- Seed the default org for this deployment
INSERT INTO public.organizations (name, code)
VALUES ('Zwane Financial Services', 'zwane')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------
-- 2. Credit Score Bands
--    Defines what each score range means: risk, max loan, rate
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_score_bands (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  label               text NOT NULL,               -- e.g. "Excellent", "Good"
  min_score           integer NOT NULL,
  max_score           integer NOT NULL,
  risk_level          text NOT NULL CHECK (risk_level IN ('low','medium','high','declined')),
  color               text DEFAULT '#10b981',      -- hex for UI badge

  -- Loan offer limits
  max_loan_amount     numeric(12,2) NOT NULL DEFAULT 0,
  interest_rate_pa    numeric(5,2)  NOT NULL DEFAULT 0,  -- Annual %
  max_term_months     integer DEFAULT 12,
  initiation_fee_pct  numeric(5,2)  DEFAULT 0,           -- % of loan amount
  monthly_service_fee numeric(10,2) DEFAULT 0,           -- flat monthly fee

  -- Auto-decisioning
  auto_decision       text DEFAULT 'review' CHECK (auto_decision IN ('approve','review','decline')),

  is_active           boolean DEFAULT true,
  sort_order          integer DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  CONSTRAINT no_overlapping_bands UNIQUE (organization_id, min_score, max_score)
);

-- Seed sensible defaults for Zwane
INSERT INTO public.credit_score_bands
  (organization_id, label, min_score, max_score, risk_level, color,
   max_loan_amount, interest_rate_pa, max_term_months, auto_decision, sort_order)
SELECT
  o.id,
  b.label, b.min_score, b.max_score, b.risk_level, b.color,
  b.max_loan, b.rate, b.term, b.decision, b.ord
FROM public.organizations o
CROSS JOIN (VALUES
  ('Excellent',  800, 999, 'low',      '#10b981', 20000, 18.00, 24, 'approve', 1),
  ('Good',       700, 799, 'low',      '#3b82f6', 15000, 22.00, 18, 'approve', 2),
  ('Fair',       580, 699, 'medium',   '#f59e0b', 8000,  27.50, 12, 'review',  3),
  ('Poor',       300, 579, 'high',     '#ef4444', 3000,  35.00,  6, 'review',  4),
  ('Declined',     0, 299, 'declined', '#6b7280', 0,     0,      0, 'decline', 5)
) AS b(label, min_score, max_score, risk_level, color, max_loan, rate, term, decision, ord)
WHERE o.code = 'zwane'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------
-- 3. Eligibility Rules
--    Hard pass/fail criteria checked before score bands
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.credit_eligibility_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  rule_key          text NOT NULL,  -- machine key
  rule_label        text NOT NULL,  -- human label for admin UI
  description       text,           -- tooltip/help text

  operator          text NOT NULL CHECK (operator IN ('gte','lte','eq','neq','is_true','is_false')),
  threshold_value   text,           -- e.g. "500", "21", "0.45"

  fail_action       text NOT NULL DEFAULT 'decline' CHECK (fail_action IN ('decline','review')),
  decline_reason    text,           -- shown to borrower on decline

  is_active         boolean DEFAULT true,
  sort_order        integer DEFAULT 0,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),

  UNIQUE(organization_id, rule_key)
);

-- Seed common South African micro-lending rules
INSERT INTO public.credit_eligibility_rules
  (organization_id, rule_key, rule_label, description, operator, threshold_value,
   fail_action, decline_reason, sort_order)
SELECT
  o.id,
  r.rule_key, r.label, r.description, r.operator, r.threshold,
  r.fail_action, r.reason, r.ord
FROM public.organizations o
CROSS JOIN (VALUES
  ('min_credit_score',
   'Minimum Credit Score',
   'Applicant must have at least this Experian score to qualify.',
   'gte', '300', 'decline',
   'Your credit score does not meet our minimum requirement.', 1),

  ('min_monthly_income',
   'Minimum Monthly Income (R)',
   'Gross monthly income before deductions.',
   'gte', '3000', 'decline',
   'Your declared monthly income is below our minimum requirement.', 2),

  ('max_debt_to_income_pct',
   'Maximum Debt-to-Income Ratio (%)',
   'Total monthly debt obligations as a % of gross income. E.g. 45 = 45%.',
   'lte', '45', 'review',
   'Your current debt obligations are too high relative to your income.', 3),

  ('min_age',
   'Minimum Applicant Age',
   'Applicant must be at least this age (years).',
   'gte', '18', 'decline',
   'You must be at least 18 years old to apply.', 4),

  ('max_age',
   'Maximum Applicant Age',
   'Applicant must not exceed this age (years).',
   'lte', '65', 'review',
   'Your age falls outside our standard lending criteria.', 5),

  ('no_active_judgments',
   'No Active Court Judgments',
   'Applicant must have no active court judgments on their credit profile.',
   'is_true', null, 'decline',
   'Active court judgments have been found on your credit profile.', 6),

  ('no_sequestration',
   'No Active Sequestration/Administration',
   'Applicant must not be under debt review, sequestration or administration.',
   'is_true', null, 'decline',
   'You are currently under debt review or administration.', 7),

  ('employed_or_self_employed',
   'Must Be Employed or Self-Employed',
   'Applicant must have a regular income source.',
   'is_true', null, 'decline',
   'Proof of employment or income is required to apply.', 8)
) AS r(rule_key, label, description, operator, threshold, fail_action, reason, ord)
WHERE o.code = 'zwane'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------
-- 4. Row Level Security
-- ---------------------------------------------------------------
ALTER TABLE public.organizations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_score_bands      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_eligibility_rules ENABLE ROW LEVEL SECURITY;

-- Admins can read/write everything
CREATE POLICY "Admins manage organizations"
  ON public.organizations FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

CREATE POLICY "Admins manage credit bands"
  ON public.credit_score_bands FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

CREATE POLICY "Admins manage eligibility rules"
  ON public.credit_eligibility_rules FOR ALL
  USING (auth.jwt() ->> 'role' IN ('admin','super_admin','base_admin'));

-- Service role (backend API) can read everything
CREATE POLICY "Service reads organizations"
  ON public.organizations FOR SELECT USING (true);

CREATE POLICY "Service reads credit bands"
  ON public.credit_score_bands FOR SELECT USING (true);

CREATE POLICY "Service reads eligibility rules"
  ON public.credit_eligibility_rules FOR SELECT USING (true);

-- ---------------------------------------------------------------
-- 5. Helper: updated_at trigger
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_organizations_updated_at           ON public.organizations;
DROP TRIGGER IF EXISTS trg_credit_score_bands_updated_at      ON public.credit_score_bands;
DROP TRIGGER IF EXISTS trg_credit_eligibility_rules_updated_at ON public.credit_eligibility_rules;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_credit_score_bands_updated_at
  BEFORE UPDATE ON public.credit_score_bands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_credit_eligibility_rules_updated_at
  BEFORE UPDATE ON public.credit_eligibility_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
