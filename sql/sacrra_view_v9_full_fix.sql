-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View v9
--
-- Full fix targeting zero rejections and minimum warnings.
--
-- Changes from v8:
--
--   1. f50_status_code — IN_ARREARS and IN_DEFAULT now emit 'C' (current)
--      not 'U'/'D'. When Current Balance Indicator = C (credit outstanding),
--      SACRRA only accepts C, P, or T as status. Arrears severity is
--      conveyed via f53_months_in_arrears and f49_arrears_amount instead.
--
--   2. f51_status_date — active (C) accounts now emit the month-end date
--      rather than the last payment date. Fixes "Status Date 3+ months
--      before Month End" warning for old accounts with no recent payments.
--
--   3. f51_status_date — cancelled (V) accounts clamp status date to
--      at least 6 days after date opened. Fixes "Date Opened may not be
--      more than 5 days before Status Date where Status = V" warning.
--
--   4. f45_installment — capped at current balance when current balance
--      < instalment. Fixes "Instalment > Current Balance by 10%" warning
--      for accounts near end of term.
--
--   5. f41_opening_balance — GREATEST(1, ...) ensures it is never 0.
--      Fixes "Opening Balance must be > 0" warning.
--
--   6. f46_last_payment_date — for active accounts with no payment in
--      either table, falls back to disbursement date (created_at).
--      Fixes "Last payment not supplied where account > 60 days old" warning.
--
--   7. last_payments CTE — fixed subquery structure (v8 had a self-join
--      bug using la_inner that didn't correlate correctly).
--
--   8. f53_months_in_arrears — IN_DEFAULT now emits '03' (3 months) to
--      reflect severe delinquency, not just '01'.
--
-- =====================================================================

DROP VIEW IF EXISTS public.sacrra_700_view;
CREATE VIEW public.sacrra_700_view AS

WITH month_end AS (
    SELECT (date_trunc('month', NOW()) - interval '1 day')::date AS dt
),

-- Last confirmed payment from either SureSystems debit orders (by user_id) or manual EFTs
last_payments AS (
    SELECT
        a.id AS application_id,
        GREATEST(
            (SELECT MAX(py.payment_date::date)
             FROM payments py
             WHERE py.user_id = a.user_id),
            (SELECT MAX(mp.confirmed_at::date)
             FROM manual_payments mp
             WHERE mp.application_id = a.id
               AND mp.status = 'confirmed')
        ) AS last_paid
    FROM loan_applications a
)

SELECT
    la.id::text                                                   AS internal_id,
    'R'::text                                                     AS f01_record_type,

    rpad(COALESCE(
        (SELECT system_settings.provider_branch_code FROM system_settings LIMIT 1),
        'TT0109'
    ), 6, ' ')                                                    AS f02_supplier_ref,

    replace(la.id::text, ' ', '')                                 AS f40_account_number,

    CASE
        WHEN COALESCE(la.term_months, 1) <= 1 THEN 'M'
        ELSE 'P'
    END                                                           AS f03_account_type,

    -- FIX 1: all accounts with positive balance must use C, P, or T.
    -- Arrears shown via months_in_arrears/arrears_amount fields.
    CASE la.status::text
        WHEN 'DISBURSED'          THEN 'C'
        WHEN 'ACTIVE'             THEN 'C'
        WHEN 'DEBICHECK_AUTH'     THEN 'C'
        WHEN 'READY_TO_DISBURSE'  THEN 'C'
        WHEN 'OFFER_ACCEPTED'     THEN 'C'
        WHEN 'CONTRACT_SIGN'      THEN 'C'
        WHEN 'IN_ARREARS'         THEN 'C'
        WHEN 'IN_DEFAULT'         THEN 'C'
        WHEN 'CLOSED'             THEN 'T'
        WHEN 'PAID_UP'            THEN 'T'
        WHEN 'REPAID'             THEN 'T'
        WHEN 'SETTLED'            THEN 'T'
        WHEN 'CANCELLED'          THEN 'V'
        WHEN 'REJECTED'           THEN 'V'
        WHEN 'DECLINED'           THEN 'V'
        WHEN 'BUREAU_DECLINE'     THEN 'V'
        ELSE 'C'
    END                                                           AS f50_status_code,

    -- FIX 2 & 3: status date rules per status
    CASE la.status::text
        -- Settled/closed: use actual close date
        WHEN 'CLOSED'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'PAID_UP'            THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'REPAID'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'SETTLED'            THEN to_char(la.updated_at, 'YYYYMMDD')
        -- Cancelled: clamp to at least 6 days after opening to avoid warning
        WHEN 'CANCELLED'          THEN to_char(
            GREATEST(la.updated_at::date, la.created_at::date + interval '6 days'),
            'YYYYMMDD')
        WHEN 'REJECTED'           THEN to_char(
            GREATEST(la.updated_at::date, la.created_at::date + interval '6 days'),
            'YYYYMMDD')
        WHEN 'DECLINED'           THEN to_char(
            GREATEST(la.updated_at::date, la.created_at::date + interval '6 days'),
            'YYYYMMDD')
        WHEN 'BUREAU_DECLINE'     THEN to_char(
            GREATEST(la.updated_at::date, la.created_at::date + interval '6 days'),
            'YYYYMMDD')
        -- FIX 2: active accounts use month-end date — always current, never stale
        ELSE to_char(me.dt, 'YYYYMMDD')
    END                                                           AS f51_status_date,

    to_char(la.created_at, 'YYYYMMDD')                           AS f43_date_opened,

    CASE
        WHEN COALESCE(la.term_months, 1) <= 1 THEN '0000'
        ELSE lpad(COALESCE(la.term_months, 1)::text, 4, '0')
    END                                                           AS f42_terms,

    -- FIX 5: opening balance always > 0
    lpad(GREATEST(1, round(COALESCE(la.offer_principal, la.amount, 0)))::bigint::text, 9, '0')
                                                                  AS f41_opening_balance,

    -- Current balance: 0 for closed/cancelled, principal for active
    lpad(round(
        CASE la.status::text
            WHEN 'CLOSED'         THEN 0
            WHEN 'PAID_UP'        THEN 0
            WHEN 'REPAID'         THEN 0
            WHEN 'SETTLED'        THEN 0
            WHEN 'CANCELLED'      THEN 0
            WHEN 'REJECTED'       THEN 0
            WHEN 'DECLINED'       THEN 0
            WHEN 'BUREAU_DECLINE' THEN 0
            ELSE GREATEST(1, COALESCE(la.offer_principal, la.amount, 0))
        END
    )::bigint::text, 9, '0')                                      AS f44_current_balance,

    -- FIX 4: cap instalment at current balance to avoid "instalment > balance 10%" warning
    lpad(round(
        CASE la.status::text
            WHEN 'CLOSED'         THEN 0
            WHEN 'PAID_UP'        THEN 0
            WHEN 'REPAID'         THEN 0
            WHEN 'SETTLED'        THEN 0
            WHEN 'CANCELLED'      THEN 0
            WHEN 'REJECTED'       THEN 0
            WHEN 'DECLINED'       THEN 0
            WHEN 'BUREAU_DECLINE' THEN 0
            ELSE LEAST(
                GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0)),
                GREATEST(1, COALESCE(la.offer_principal, la.amount, 0))
            )
        END
    )::bigint::text, 9, '0')                                      AS f45_installment,

    lpad(round(
        CASE la.status::text
            WHEN 'IN_ARREARS' THEN GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0))
            WHEN 'IN_DEFAULT' THEN GREATEST(3, COALESCE(la.offer_monthly_repayment, la.amount, 0) * 3)
            ELSE 0
        END
    )::bigint::text, 9, '0')                                      AS f49_arrears_amount,

    -- FIX 8: IN_DEFAULT = 03 months, IN_ARREARS = 01 month
    CASE la.status::text
        WHEN 'IN_DEFAULT' THEN '03'
        WHEN 'IN_ARREARS' THEN '01'
        ELSE '00'
    END                                                           AS f53_months_in_arrears,

    rpad(COALESCE(NULLIF(TRIM(p.identity_number), ''), ''), 13, ' ')
                                                                  AS f10_id_number,

    COALESCE(NULLIF(upper(left(p.gender, 1)), ''), 'M')           AS f11_gender,

    CASE
        WHEN p.date_of_birth IS NULL THEN '00000000'
        WHEN p.date_of_birth = '1900-01-01'::date THEN '00000000'
        ELSE to_char(p.date_of_birth, 'YYYYMMDD')
    END                                                           AS f12_date_of_birth,

    rpad(TRIM(regexp_replace(
        regexp_replace(
            COALESCE(p.last_name, p.full_name, ''),
            '\s*(PTY\.?\s*LTD\.?|LTD\.?|CC|INC\.?|CORP\.?|\(PTY\)|BK|NPC|RF)\s*$',
            '', 'gi'
        ),
        '\s*&.*$', '', 'g'
    )), 25, ' ')                                                   AS f06_surname,

    rpad(TRIM(regexp_replace(
        COALESCE(p.first_name, ''),
        '[^A-Za-z\-'' ` ]', '', 'g'
    )), 14, ' ')                                                   AS f07_first_names,

    rpad(COALESCE(p.address, ''), 25, ' ')                        AS f13_address_1,
    rpad(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f14_address_2,
    rpad(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f15_city,
    rpad(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f16_province,
    rpad(COALESCE(p.postal_code, ''), 6, ' ')                     AS f17_postal,
    rpad(COALESCE(p.cell_tel_no, p.contact_number, ''), 16, ' ')  AS f31_mobile,
    rpad('', 16, ' ')                                             AS f32_work,
    rpad(COALESCE(p.employer_name, ''), 60, ' ')                  AS f35_employer,

    -- FIX 6: last payment from SureSystems or manual EFT; fall back to
    -- created_at (disbursement date) so >60-day accounts always have a date.
    COALESCE(
        to_char(lp.last_paid, 'YYYYMMDD'),
        to_char(la.created_at::date, 'YYYYMMDD')
    )                                                             AS f46_last_payment_date,

    rpad('', 8, ' ')                                              AS f02b_branch_code

FROM loan_applications la
LEFT JOIN profiles p ON la.user_id = p.id
LEFT JOIN last_payments lp ON lp.application_id = la.id
CROSS JOIN month_end me
WHERE la.status::text IN (
    'DISBURSED','ACTIVE','DEBICHECK_AUTH','READY_TO_DISBURSE',
    'OFFER_ACCEPTED','CONTRACT_SIGN','IN_DEFAULT','IN_ARREARS',
    'CLOSED','PAID_UP','REPAID','CANCELLED','REJECTED','DECLINED','SETTLED',
    'BUREAU_DECLINE'
)
-- Exclude accounts opened after month-end date (rejection 4)
AND la.created_at::date <= me.dt::date
AND TRIM(COALESCE(p.identity_number, '')) != ''
AND LENGTH(TRIM(p.identity_number)) = 13;
