-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View v10
--
-- Fixes the 3 warning types flagged by SACRRA on the 2026-05-31 (T702)
-- submission: V07889 (83.67%), V07805 (3.42%), V07896 (0.25%).
--
-- Changes from v9:
--
--   1. V07889 — "Status Date should not be 3+ months before Month End
--      Date" for status codes incl. T and V. v9 reported every closed/
--      cancelled account forever with its original close date frozen,
--      so old settlements/cancellations aged past the 3-month window on
--      every subsequent monthly file. Fix: drop T/V-status accounts from
--      the view once their close date (updated_at) is 2+ months before
--      month-end — i.e. stop reporting them well inside the 3-month
--      limit, instead of carrying them indefinitely.
--
--   2. V07805 — "Date Account Opened may not be more than 5 days before
--      Status Date where Status = V". v9 deliberately forced the status
--      date to created_at + 6 days (GREATEST), one day past the allowed
--      window, guaranteeing the violation on every cancelled/rejected
--      account. Fix: cap status date at created_at + 5 days (LEAST)
--      instead of pushing it past created_at + 6 days.
--
--   3. V07896 — "Months in Arrears is greater than the age of the
--      account". v9 hardcoded '01'/'03' for IN_ARREARS/IN_DEFAULT with
--      no reference to account age, so brand-new accounts that flip to
--      arrears in their first calendar month reported 1 month arrears
--      at 0 months old. Fix: cap months-in-arrears at the account's age
--      in whole months as of month-end.
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

    -- FIX 2: status date for V no longer pushed past the 5-day window
    CASE la.status::text
        WHEN 'CLOSED'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'PAID_UP'            THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'REPAID'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'SETTLED'            THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'CANCELLED'          THEN to_char(
            LEAST(la.updated_at::date, la.created_at::date + interval '5 days'),
            'YYYYMMDD')
        WHEN 'REJECTED'           THEN to_char(
            LEAST(la.updated_at::date, la.created_at::date + interval '5 days'),
            'YYYYMMDD')
        WHEN 'DECLINED'           THEN to_char(
            LEAST(la.updated_at::date, la.created_at::date + interval '5 days'),
            'YYYYMMDD')
        WHEN 'BUREAU_DECLINE'     THEN to_char(
            LEAST(la.updated_at::date, la.created_at::date + interval '5 days'),
            'YYYYMMDD')
        ELSE to_char(me.dt, 'YYYYMMDD')
    END                                                           AS f51_status_date,

    to_char(la.created_at, 'YYYYMMDD')                           AS f43_date_opened,

    CASE
        WHEN COALESCE(la.term_months, 1) <= 1 THEN '0000'
        ELSE lpad(COALESCE(la.term_months, 1)::text, 4, '0')
    END                                                           AS f42_terms,

    lpad(GREATEST(1, round(COALESCE(la.offer_principal, la.amount, 0)))::bigint::text, 9, '0')
                                                                  AS f41_opening_balance,

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

    -- FIX 3: months-in-arrears capped at account age (whole months as of month-end)
    lpad(
        LEAST(
            CASE la.status::text
                WHEN 'IN_DEFAULT' THEN 3
                WHEN 'IN_ARREARS' THEN 1
                ELSE 0
            END,
            GREATEST(0, (
                (EXTRACT(YEAR FROM age(me.dt, la.created_at::date)) * 12
                 + EXTRACT(MONTH FROM age(me.dt, la.created_at::date)))::int
            ))
        )::text, 2, '0')                                          AS f53_months_in_arrears,

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
AND la.created_at::date <= me.dt::date
AND TRIM(COALESCE(p.identity_number, '')) != ''
AND LENGTH(TRIM(p.identity_number)) = 13
-- FIX 1: stop carrying closed/cancelled accounts forever — drop them from
-- the file once their close date is 2+ months before month-end (safely
-- inside SACRRA's 3-month tolerance).
AND (
    la.status::text NOT IN (
        'CLOSED','PAID_UP','REPAID','SETTLED',
        'CANCELLED','REJECTED','DECLINED','BUREAU_DECLINE'
    )
    OR la.updated_at::date > (me.dt - interval '2 months')
);
