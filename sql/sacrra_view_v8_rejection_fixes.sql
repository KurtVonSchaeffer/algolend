-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View v8
--
-- Fixes from v7 (addressing bureau load report rejections):
--
--   1. f50_status_code — active/performing loans now emit 'C' (current)
--      instead of blank ''. Blank status code caused "Current Balance
--      Indicator = C, Status Code must = C, P or T" rejections.
--
--   2. f43_date_opened filter — accounts where created_at > month-end
--      date are excluded. Previously caused "Date account opened is after
--      Header records Month-end Date" rejections.
--
--   3. f46_last_payment_date — also checks payments table (SureSystems
--      debit orders) in addition to manual_payments, so accounts older
--      than 36 months with debit order history are no longer rejected.
--
--   4. f51_status_date — active accounts (Status = C) now emit the
--      most recent payment date or disbursement date rather than
--      '00000000', satisfying the 36-month recency rule for old accounts.
--
-- =====================================================================

DROP VIEW IF EXISTS public.sacrra_700_view;
CREATE VIEW public.sacrra_700_view AS

-- Derive month-end date from the most recent month (used for date filters)
WITH month_end AS (
    SELECT date_trunc('month', NOW()) - interval '1 day' AS dt
),

last_payments AS (
    SELECT
        application_id,
        MAX(COALESCE(
            -- SureSystems debit order payments
            (SELECT MAX(py.payment_date::date)
             FROM payments py
             WHERE py.application_id = la_inner.id),
            -- Manual EFT payments
            (SELECT MAX(mp.confirmed_at::date)
             FROM manual_payments mp
             WHERE mp.application_id = la_inner.id
               AND mp.status = 'confirmed')
        )) AS last_paid
    FROM loan_applications la_inner
    GROUP BY application_id
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

    -- FIX 1: active/performing accounts must use 'C' not blank
    CASE la.status::text
        WHEN 'DISBURSED'          THEN 'C'
        WHEN 'ACTIVE'             THEN 'C'
        WHEN 'DEBICHECK_AUTH'     THEN 'C'
        WHEN 'READY_TO_DISBURSE'  THEN 'C'
        WHEN 'OFFER_ACCEPTED'     THEN 'C'
        WHEN 'CONTRACT_SIGN'      THEN 'C'
        WHEN 'IN_ARREARS'         THEN 'U'
        WHEN 'IN_DEFAULT'         THEN 'D'
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

    -- FIX 4: active accounts emit last payment/disbursement date for 36-month rule
    CASE la.status::text
        WHEN 'CLOSED'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'PAID_UP'            THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'REPAID'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'SETTLED'            THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'CANCELLED'          THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'REJECTED'           THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'DECLINED'           THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'BUREAU_DECLINE'     THEN to_char(la.updated_at, 'YYYYMMDD')
        ELSE COALESCE(
            to_char(lp.last_paid, 'YYYYMMDD'),
            to_char(la.created_at, 'YYYYMMDD')
        )
    END                                                           AS f51_status_date,

    to_char(la.created_at, 'YYYYMMDD')                           AS f43_date_opened,

    CASE
        WHEN COALESCE(la.term_months, 1) <= 1 THEN '0000'
        ELSE lpad(COALESCE(la.term_months, 1)::text, 4, '0')
    END                                                           AS f42_terms,

    lpad(round(COALESCE(la.offer_principal, la.amount, 0))::bigint::text, 9, '0')
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
            ELSE GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0))
        END
    )::bigint::text, 9, '0')                                      AS f45_installment,

    lpad(round(
        CASE la.status::text
            WHEN 'IN_DEFAULT' THEN GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0))
            WHEN 'IN_ARREARS' THEN GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0))
            ELSE 0
        END
    )::bigint::text, 9, '0')                                      AS f49_arrears_amount,

    CASE la.status::text
        WHEN 'IN_DEFAULT' THEN '01'
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

    -- FIX 3: check both payments (SureSystems) and manual_payments
    COALESCE(
        to_char(lp.last_paid, 'YYYYMMDD'),
        '00000000'
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
-- FIX 2: exclude accounts opened after month-end date
AND la.created_at::date <= me.dt::date
AND TRIM(COALESCE(p.identity_number, '')) != ''
AND LENGTH(TRIM(p.identity_number)) = 13;
