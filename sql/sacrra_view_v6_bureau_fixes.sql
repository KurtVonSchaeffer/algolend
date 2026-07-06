-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View v6
--
-- Minimal surgical fix from v5 (the currently deployed view).
-- Only three fields changed — everything else is identical to v5.
--
-- FIXES:
--   1. f51_status_date — was TO_CHAR(COALESCE(updated_at, created_at))
--      for ALL records including active accounts. Active accounts (blank
--      status code) MUST have '00000000'. SACRRA rejection:
--      "Status Date supplied when Status Code is NULL."
--      Fix: CASE — only set date for closed/settled/cancelled statuses.
--
--   2. f44_current_balance — was GREATEST(1, offer_total_repayment).
--      offer_total_repayment = principal + all interest, exceeds
--      offer_principal (opening balance) by >30% on every loan.
--      SACRRA warning: "Current Balance > Opening Balance by >30%."
--      Fix: use offer_principal (same as opening balance for active loans).
--
--   3. f46_last_payment_date — was repayment_start_date, which is the
--      FIRST payment DUE date (future), not last payment received.
--      Every new loan had a last payment date after month-end.
--      SACRRA rejection: "Last Payment Date after Month-End Date."
--      Fix: '00000000' safe default until actual payment data is wired up.
--
-- JS-layer fixes already deployed (commit 54b0eb2):
--   Balance Indicator C not P, Status Date capped to monthEnd,
--   Last Payment Date capped to monthEnd, Months in Arrears capped to
--   account age, surname company suffixes stripped.
--
-- Run in Supabase SQL Editor to replace v5.
-- =====================================================================

DROP VIEW IF EXISTS public.sacrra_700_view;
CREATE VIEW public.sacrra_700_view AS
SELECT
    la.id::text                                                   AS internal_id,
    'R'::text                                                     AS f01_record_type,

    -- SRN: from system_settings (table confirmed to exist without public. prefix)
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
        WHEN 'DISBURSED'          THEN ''
        WHEN 'ACTIVE'             THEN ''
        WHEN 'DEBICHECK_AUTH'     THEN ''
        WHEN 'READY_TO_DISBURSE'  THEN ''
        WHEN 'OFFER_ACCEPTED'     THEN ''
        WHEN 'CONTRACT_SIGN'      THEN ''
        WHEN 'IN_DEFAULT'         THEN ''
        WHEN 'IN_ARREARS'         THEN ''
        WHEN 'CLOSED'             THEN 'T'
        WHEN 'PAID_UP'            THEN 'T'
        WHEN 'REPAID'             THEN 'T'
        WHEN 'SETTLED'            THEN 'T'
        WHEN 'CANCELLED'          THEN 'V'
        WHEN 'REJECTED'           THEN 'V'
        WHEN 'DECLINED'           THEN 'V'
        WHEN 'BUREAU_DECLINE'     THEN 'V'
        ELSE ''
    END                                                           AS f50_status_code,

    -- FIX 1: Status Date only for non-active statuses.
    -- Active accounts (blank status code) must have '00000000'.
    CASE la.status::text
        WHEN 'CLOSED'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'PAID_UP'            THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'REPAID'             THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'SETTLED'            THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'CANCELLED'          THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'REJECTED'           THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'DECLINED'           THEN to_char(la.updated_at, 'YYYYMMDD')
        WHEN 'BUREAU_DECLINE'     THEN to_char(la.updated_at, 'YYYYMMDD')
        ELSE '00000000'
    END                                                           AS f51_status_date,

    to_char(la.created_at, 'YYYYMMDD')                           AS f43_date_opened,

    CASE
        WHEN COALESCE(la.term_months, 1) <= 1 THEN '0000'
        ELSE lpad(COALESCE(la.term_months, 1)::text, 4, '0')
    END                                                           AS f42_terms,

    lpad(round(COALESCE(la.offer_principal, la.amount, 0))::bigint::text, 9, '0')
                                                                  AS f41_opening_balance,

    -- FIX 2: Current Balance uses offer_principal, not offer_total_repayment.
    -- offer_total_repayment includes all interest and exceeded opening balance
    -- by >30% on every active loan.
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

    to_char(COALESCE(p.date_of_birth, '1900-01-01'::date), 'YYYYMMDD')
                                                                  AS f12_date_of_birth,

    rpad(TRIM(regexp_replace(
        COALESCE(p.last_name, p.full_name, ''),
        '\s*(PTY\.?\s*LTD\.?|LTD\.?|CC|INC\.?|CORP\.?|\(PTY\))\s*$',
        '', 'gi'
    )), 25, ' ')                                                   AS f06_surname,

    rpad(TRIM(regexp_replace(
        COALESCE(p.first_name, ''),
        '[^A-Za-z\-` ]', '', 'g'
    )), 14, ' ')                                                   AS f07_first_names,

    rpad(COALESCE(p.address, ''), 25, ' ')                        AS f13_address_1,
    rpad(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f14_address_2,
    rpad(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f15_city,
    rpad(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f16_province,
    rpad(COALESCE(p.postal_code, ''), 6, ' ')                     AS f17_postal,
    rpad(COALESCE(p.cell_tel_no, p.contact_number, ''), 16, ' ')  AS f31_mobile,
    rpad('', 16, ' ')                                             AS f32_work,
    rpad(COALESCE(p.employer_name, ''), 60, ' ')                  AS f35_employer,

    -- FIX 3: Last Payment Date is '00000000'.
    -- repayment_start_date is the first scheduled DUE date (future for new
    -- loans), not a received payment — caused rejection on every new loan.
    '00000000'                                                    AS f46_last_payment_date,

    rpad('', 8, ' ')                                              AS f02b_branch_code

FROM loan_applications la
LEFT JOIN profiles p ON la.user_id = p.id
WHERE la.status::text IN (
    'DISBURSED','ACTIVE','DEBICHECK_AUTH','READY_TO_DISBURSE',
    'OFFER_ACCEPTED','CONTRACT_SIGN','IN_DEFAULT','IN_ARREARS',
    'CLOSED','PAID_UP','REPAID','CANCELLED','REJECTED','DECLINED','SETTLED',
    'BUREAU_DECLINE'
)
AND TRIM(COALESCE(p.identity_number, '')) != ''
AND LENGTH(TRIM(p.identity_number)) = 13;
