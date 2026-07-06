-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View v4 (Status code + date fixes)
--
-- Fixes from SureSystems UAT feedback (June 2026):
--   1. IN_DEFAULT was mapped to 'D' (Disputed) — should be blank (active/arrears)
--   2. OFFER_ACCEPTED / CONTRACT_SIGN were mapped to 'P' (Paid Up) — should be blank
--   3. DATE LAST PAYMENT now uses la.last_payment_date instead of created_at
--   4. Added IN_ARREARS to WHERE clause (it was in status mapping but not in filter)
--
-- Run once in Supabase SQL Editor.
-- =====================================================================

DROP VIEW IF EXISTS public.sacrra_700_view;
CREATE VIEW public.sacrra_700_view AS
SELECT
    la.id::text                                                  AS internal_id,
    'R'                                                          AS f01_record_type,

    RPAD(COALESCE(
        (SELECT provider_branch_code FROM public.system_settings LIMIT 1),
        'AL0001'
    ), 6, ' ')                                                   AS f02_supplier_ref,

    REPLACE(la.id::text, ' ', '')                                AS f40_account_number,

    CASE WHEN COALESCE(la.term_months, 1) = 1 THEN 'M' ELSE 'P' END  AS f03_account_type,

    -- STATUS CODE mapping — blank = active/current (most common)
    -- 'D' is DISPUTED (account being queried by client) — do NOT use for default/arrears
    CASE la.status::text
        WHEN 'DISBURSED'          THEN ''   -- Active/current
        WHEN 'ACTIVE'             THEN ''   -- Active/current
        WHEN 'DEBICHECK_AUTH'     THEN ''   -- Active/current
        WHEN 'READY_TO_DISBURSE'  THEN ''   -- Active/current
        WHEN 'OFFER_ACCEPTED'     THEN ''   -- Active/current (approved, not yet funded)
        WHEN 'CONTRACT_SIGN'      THEN ''   -- Active/current (signing stage)
        WHEN 'IN_DEFAULT'         THEN ''   -- Active with arrears (tracked via months_in_arrears field)
        WHEN 'IN_ARREARS'         THEN ''   -- Active with arrears
        WHEN 'CLOSED'             THEN 'T'  -- T = Settled/Paid up
        WHEN 'PAID_UP'            THEN 'T'  -- T = Settled/Paid up
        WHEN 'REPAID'             THEN 'T'  -- T = Settled/Paid up
        WHEN 'SETTLED'            THEN 'T'  -- T = Settled
        WHEN 'CANCELLED'          THEN 'V'  -- V = Cancelled
        WHEN 'REJECTED'           THEN 'V'  -- V = Cancelled
        WHEN 'DECLINED'           THEN 'V'  -- V = Cancelled
        WHEN 'BUREAU_DECLINE'     THEN 'V'  -- V = Cancelled
        ELSE ''                             -- Default: active
    END                                                          AS f50_status_code,

    TO_CHAR(COALESCE(la.updated_at, la.created_at), 'YYYYMMDD')  AS f51_status_date,
    TO_CHAR(la.created_at, 'YYYYMMDD')                           AS f43_date_opened,

    -- Financial fields — N9 whole rands per Layout 700v2 spec
    LPAD(ROUND(COALESCE(la.offer_principal, la.amount, 0))::bigint::text, 9, '0')
                                                                 AS f41_opening_balance,

    LPAD(ROUND(
        CASE la.status::text
            WHEN 'CLOSED'         THEN 0
            WHEN 'PAID_UP'        THEN 0
            WHEN 'REPAID'         THEN 0
            WHEN 'SETTLED'        THEN 0
            WHEN 'CANCELLED'      THEN 0
            WHEN 'REJECTED'       THEN 0
            WHEN 'DECLINED'       THEN 0
            WHEN 'BUREAU_DECLINE' THEN 0
            ELSE COALESCE(la.offer_total_repayment, la.offer_principal, la.amount, 0)
        END
    )::bigint::text, 9, '0')                                     AS f44_current_balance,

    LPAD(ROUND(COALESCE(la.offer_monthly_repayment, 0))::bigint::text, 9, '0')
                                                                 AS f45_installment,

    LPAD(ROUND(
        CASE la.status::text
            WHEN 'IN_DEFAULT' THEN COALESCE(la.offer_monthly_repayment, 0)
            WHEN 'IN_ARREARS' THEN COALESCE(la.offer_monthly_repayment, 0)
            ELSE 0
        END
    )::bigint::text, 9, '0')                                     AS f49_arrears_amount,

    CASE la.status::text
        WHEN 'IN_DEFAULT' THEN '01'
        WHEN 'IN_ARREARS' THEN '01'
        ELSE '00'
    END                                                          AS f53_months_in_arrears,

    RPAD(COALESCE(p.identity_number, ''), 13, ' ')               AS f10_id_number,
    COALESCE(p.gender, 'M')                                      AS f11_gender,
    TO_CHAR(COALESCE(p.date_of_birth, '1900-01-01'::date), 'YYYYMMDD') AS f12_date_of_birth,
    RPAD(COALESCE(p.last_name, p.full_name, ''), 25, ' ')        AS f06_surname,
    RPAD(COALESCE(p.first_name, ''), 14, ' ')                    AS f07_first_names,
    RPAD(COALESCE(p.address, ''), 25, ' ')                       AS f13_address_1,
    RPAD(COALESCE(p.suburb_area, ''), 25, ' ')                   AS f14_address_2,
    RPAD(COALESCE(p.suburb_area, ''), 25, ' ')                   AS f15_city,
    RPAD(COALESCE(p.suburb_area, ''), 25, ' ')                   AS f16_province,
    RPAD(COALESCE(p.postal_code, ''), 6, ' ')                    AS f17_postal,
    RPAD(COALESCE(p.cell_tel_no, p.contact_number, ''), 16, ' ') AS f31_mobile,
    RPAD('', 16, ' ')                                            AS f32_work,
    RPAD(COALESCE(p.employer_name, ''), 60, ' ')                 AS f35_employer,
    LPAD(COALESCE(la.term_months, 1)::text, 4, '0')              AS f42_terms,

    -- DATE LAST PAYMENT: use updated_at as proxy (last_payment_date lives on loans table, not loan_applications)
    TO_CHAR(
        COALESCE(la.updated_at, la.created_at),
        'YYYYMMDD'
    )                                                            AS f46_last_payment_date

FROM public.loan_applications la
LEFT JOIN public.profiles p ON la.user_id = p.id
WHERE la.status::text IN (
    'DISBURSED','ACTIVE','DEBICHECK_AUTH','READY_TO_DISBURSE',
    'OFFER_ACCEPTED','CONTRACT_SIGN','IN_DEFAULT','IN_ARREARS',
    'CLOSED','PAID_UP','REPAID','CANCELLED','REJECTED','DECLINED','SETTLED',
    'BUREAU_DECLINE'
);
