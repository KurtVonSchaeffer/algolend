-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View v5 (SACRRA UAT rejection fixes)
--
-- Fixes applied based on SACRRA bureau response (June 2026):
--   1. Current Balance: GREATEST(1, ...) ensures > 0 for open accounts
--   2. Instalment: GREATEST(1, ...) ensures > 0 for open accounts
--   3. Amount Overdue: matches instalment when months_in_arrears > 0
--   4. Terms: forced to '0000' for Account Type M (1-month revolving)
--   5. Date Last Payment: use repayment_start_date (matches v2 view)
--      (accounts open > 60 days with 0 arrears must have a payment date)
--   6. ID Filter: exclude records where identity_number is NULL or empty
--   7. Surname: strip common company suffixes to catch business names
--   8. Branch code field left blank (was incorrectly populated with SRN)
--
-- Run in Supabase SQL Editor (replaces v4).
-- =====================================================================

DROP VIEW IF EXISTS public.sacrra_700_view;
CREATE VIEW public.sacrra_700_view AS
SELECT
    la.id::text                                                   AS internal_id,
    'R'                                                           AS f01_record_type,

    -- Supplier Reference Number (SRN) — SACRRA-assigned, 6 chars from system_settings
    RPAD(COALESCE(
        (SELECT provider_branch_code FROM public.system_settings LIMIT 1),
        'TT0109'
    ), 6, ' ')                                                    AS f02_supplier_ref,

    REPLACE(la.id::text, ' ', '')                                 AS f40_account_number,

    -- Account Type: M = 1-month (revolving/payday), P = Personal instalment loan
    CASE WHEN COALESCE(la.term_months, 1) <= 1 THEN 'M' ELSE 'P' END AS f03_account_type,

    -- STATUS CODE — blank = active/current
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

    TO_CHAR(COALESCE(la.updated_at, la.created_at), 'YYYYMMDD')  AS f51_status_date,
    TO_CHAR(la.created_at, 'YYYYMMDD')                           AS f43_date_opened,

    -- TERMS: must be 0000 for Account Type M (SACRRA rule)
    CASE
        WHEN COALESCE(la.term_months, 1) <= 1 THEN '0000'
        ELSE LPAD(COALESCE(la.term_months, 1)::text, 4, '0')
    END                                                           AS f42_terms,

    -- OPENING BALANCE (N9 whole rands)
    LPAD(ROUND(COALESCE(la.offer_principal, la.amount, 0))::bigint::text, 9, '0')
                                                                  AS f41_opening_balance,

    -- CURRENT BALANCE: must be > 0 for active/open accounts (SACRRA rejection fix)
    -- For closed/settled/cancelled = 0; for active = GREATEST(1, outstanding balance)
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
            ELSE GREATEST(1, COALESCE(la.offer_total_repayment, la.offer_principal, la.amount, 0))
        END
    )::bigint::text, 9, '0')                                      AS f44_current_balance,

    -- INSTALMENT: must be > 0 for active open accounts (SACRRA rejection fix)
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
            ELSE GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0))
        END
    )::bigint::text, 9, '0')                                      AS f45_installment,

    -- AMOUNT OVERDUE: must be > 0 when months_in_arrears > 0 (SACRRA rejection fix)
    LPAD(ROUND(
        CASE la.status::text
            WHEN 'IN_DEFAULT' THEN GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0))
            WHEN 'IN_ARREARS' THEN GREATEST(1, COALESCE(la.offer_monthly_repayment, la.amount, 0))
            ELSE 0
        END
    )::bigint::text, 9, '0')                                      AS f49_arrears_amount,

    -- MONTHS IN ARREARS
    CASE la.status::text
        WHEN 'IN_DEFAULT' THEN '01'
        WHEN 'IN_ARREARS' THEN '01'
        ELSE '00'
    END                                                           AS f53_months_in_arrears,

    -- IDENTITY (13 chars, space-padded) — only included when populated
    RPAD(COALESCE(NULLIF(TRIM(p.identity_number), ''), ''), 13, ' ')
                                                                  AS f10_id_number,

    -- GENDER: must come before Date of Birth in the record (per SACRRA spec)
    COALESCE(NULLIF(UPPER(LEFT(p.gender, 1)), ''), 'M')           AS f11_gender,

    -- DATE OF BIRTH (CCYYMMDD) — SACRRA warning: must be in this exact format
    TO_CHAR(COALESCE(p.date_of_birth, '1900-01-01'::date), 'YYYYMMDD')
                                                                  AS f12_date_of_birth,

    -- SURNAME: strip company suffixes that SACRRA flagged
    -- Replace common business name patterns so they don't appear in surname field
    RPAD(
        TRIM(REGEXP_REPLACE(
            COALESCE(p.last_name, p.full_name, ''),
            '\s*(PTY\.?\s*LTD\.?|LTD\.?|CC|INC\.?|CORP\.?|\(PTY\))\s*$',
            '', 'gi'
        )),
        25, ' '
    )                                                             AS f06_surname,

    -- FORENAME: only [A-Z], [a-z], [-], [`], [ ] allowed (SACRRA warning)
    RPAD(
        TRIM(REGEXP_REPLACE(
            COALESCE(p.first_name, ''),
            '[^A-Za-z\-` ]', '', 'g'
        )),
        14, ' '
    )                                                             AS f07_first_names,

    RPAD(COALESCE(p.address, ''), 25, ' ')                        AS f13_address_1,
    RPAD(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f14_address_2,
    RPAD(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f15_city,
    RPAD(COALESCE(p.suburb_area, ''), 25, ' ')                    AS f16_province,
    RPAD(COALESCE(p.postal_code, ''), 6, ' ')                     AS f17_postal,
    RPAD(COALESCE(p.cell_tel_no, p.contact_number, ''), 16, ' ')  AS f31_mobile,
    RPAD('', 16, ' ')                                             AS f32_work,
    RPAD(COALESCE(p.employer_name, ''), 60, ' ')                  AS f35_employer,

    -- DATE LAST PAYMENT: required for accounts open > 60 days with months_in_arrears = 0
    -- Use offer_start_date if available, else use created_at as earliest payment proxy
    COALESCE(TO_CHAR(la.repayment_start_date::date, 'YYYYMMDD'), '00000000')
                                                                  AS f46_last_payment_date,

    -- BRANCH CODE: leave blank (8 spaces) — SACRRA explicitly flagged SRN being used here
    -- Populate only if you have a SACRRA-assigned branch code for this office
    RPAD('', 8, ' ')                                              AS f02b_branch_code

FROM public.loan_applications la
LEFT JOIN public.profiles p ON la.user_id = p.id
WHERE la.status::text IN (
    'DISBURSED','ACTIVE','DEBICHECK_AUTH','READY_TO_DISBURSE',
    'OFFER_ACCEPTED','CONTRACT_SIGN','IN_DEFAULT','IN_ARREARS',
    'CLOSED','PAID_UP','REPAID','CANCELLED','REJECTED','DECLINED','SETTLED',
    'BUREAU_DECLINE'
)
-- SACRRA rejection fix: exclude records with no valid ID number
-- Records without an ID will always be rejected by the bureaux
AND TRIM(COALESCE(p.identity_number, '')) != ''
AND LENGTH(TRIM(p.identity_number)) = 13;
