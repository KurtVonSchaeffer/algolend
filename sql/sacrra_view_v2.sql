-- =====================================================================
-- SACRRA Layout 700v2 — Compliance View
-- Replaces sacrra_700_view; reads from loan_applications + profiles
-- Run once in Supabase SQL Editor
-- =====================================================================
-- Actual profiles columns used:
--   identity_number, gender, date_of_birth, first_name, last_name,
--   address, suburb_area, postal_code, cell_tel_no, contact_number
-- =====================================================================
-- Status code mapping (app status → Layout 700 code):
--   DISBURSED / ACTIVE / DEBICHECK_AUTH / READY_TO_DISBURSE  → C (Current)
--   OFFER_ACCEPTED / CONTRACT_SIGN                           → P (Payment arrangement)
--   IN_DEFAULT                                               → D (Delinquent)
--   CLOSED / PAID_UP / REPAID                               → T (Paid up)
--   CANCELLED / REJECTED / DECLINED / BUREAU_DECLINE        → V (Cancelled)
--   Everything else                                          → L (Legal / hold)
-- =====================================================================

CREATE OR REPLACE VIEW public.sacrra_700_view AS
SELECT
    la.id::text                                                  AS internal_id,

    -- Record type
    'R'                                                          AS f01_record_type,

    -- Supplier Reference Number (SRN) — 6 chars: 2 letters + 4 digits
    RPAD(COALESCE(
        (SELECT provider_branch_code FROM public.system_settings LIMIT 1),
        'AL0001'
    ), 6, ' ')                                                   AS f02_supplier_ref,

    -- Account Number (unique match key — no spaces)
    REPLACE(la.id::text, ' ', '')                                AS f40_account_number,

    -- Account type: M = one-month personal loan, P = personal loan
    CASE
        WHEN COALESCE(la.term_months, 1) = 1 THEN 'M'
        ELSE 'P'
    END                                                          AS f03_account_type,

    -- Status code mapped from application status (cast to text to avoid enum errors)
    CASE la.status::text
        WHEN 'DISBURSED'          THEN 'C'
        WHEN 'ACTIVE'             THEN 'C'
        WHEN 'DEBICHECK_AUTH'     THEN 'C'
        WHEN 'READY_TO_DISBURSE'  THEN 'C'
        WHEN 'OFFER_ACCEPTED'     THEN 'P'
        WHEN 'CONTRACT_SIGN'      THEN 'P'
        WHEN 'IN_DEFAULT'         THEN 'D'
        WHEN 'CLOSED'             THEN 'T'
        WHEN 'PAID_UP'            THEN 'T'
        WHEN 'REPAID'             THEN 'T'
        WHEN 'CANCELLED'          THEN 'V'
        WHEN 'REJECTED'           THEN 'V'
        WHEN 'DECLINED'           THEN 'V'
        WHEN 'BUREAU_DECLINE'     THEN 'V'
        ELSE                           'L'
    END                                                          AS f50_status_code,

    -- Status date (YYYYMMDD)
    TO_CHAR(COALESCE(la.updated_at, la.created_at), 'YYYYMMDD') AS f51_status_date,

    -- Account opened date (YYYYMMDD)
    TO_CHAR(la.created_at, 'YYYYMMDD')                          AS f43_date_opened,

    -- Financial fields (rand * 100 = cents, 12-digit zero-padded)
    LPAD((COALESCE(la.offer_principal, la.amount, 0) * 100)::bigint::text, 12, '0')
                                                                 AS f41_opening_balance,

    LPAD((
        CASE la.status::text
            WHEN 'CLOSED'        THEN 0
            WHEN 'PAID_UP'       THEN 0
            WHEN 'REPAID'        THEN 0
            WHEN 'CANCELLED'     THEN 0
            WHEN 'REJECTED'      THEN 0
            WHEN 'DECLINED'      THEN 0
            WHEN 'BUREAU_DECLINE' THEN 0
            ELSE COALESCE(la.offer_total_repayment, la.offer_principal, la.amount, 0)
        END * 100
    )::bigint::text, 12, '0')                                    AS f44_current_balance,

    LPAD((COALESCE(la.offer_monthly_repayment, 0) * 100)::bigint::text, 12, '0')
                                                                 AS f45_installment,

    -- Arrears (only populated for IN_DEFAULT)
    LPAD((
        CASE la.status::text
            WHEN 'IN_DEFAULT' THEN COALESCE(la.offer_monthly_repayment, 0)
            ELSE 0
        END * 100
    )::bigint::text, 12, '0')                                    AS f49_arrears_amount,

    -- Months in arrears
    CASE la.status::text WHEN 'IN_DEFAULT' THEN '01' ELSE '00' END
                                                                 AS f53_months_in_arrears,

    -- Consumer identity
    RPAD(COALESCE(p.identity_number, ''), 13, ' ')               AS f10_id_number,
    UPPER(COALESCE(p.gender, 'M'))                               AS f11_gender,
    REPLACE(COALESCE(p.date_of_birth::text, '00000000'), '-', '') AS f12_date_of_birth,

    -- Consumer name (last_name = surname, first_name = given names)
    RPAD(UPPER(COALESCE(p.last_name, '')), 30, ' ')              AS f06_surname,
    RPAD('MR', 5, ' ')                                           AS f08_title,
    RPAD(UPPER(COALESCE(p.first_name, '')), 30, ' ')             AS f07_first_names,
    RPAD('', 15, ' ')                                            AS f09_middle_names,

    -- Address (single line mapped to address_1; suburb to city)
    RPAD(COALESCE(p.address, ''), 30, ' ')                       AS f13_address_1,
    RPAD('', 30, ' ')                                            AS f14_address_2,
    RPAD(COALESCE(p.suburb_area, ''), 30, ' ')                   AS f15_city,
    RPAD('', 30, ' ')                                            AS f16_province,
    RPAD(COALESCE(p.postal_code, ''), 10, ' ')                   AS f17_postal,

    -- Employment (not held in profiles — blanked per spec allowance)
    RPAD('', 50, ' ')                                            AS f35_employer,
    RPAD('', 30, ' ')                                            AS f36_occupation,

    -- Contact
    RPAD(COALESCE(p.cell_tel_no, p.contact_number, ''), 15, ' ') AS f31_mobile,
    RPAD('', 15, ' ')                                            AS f32_work,

    -- Repayment start date
    COALESCE(TO_CHAR(la.repayment_start_date::date, 'YYYYMMDD'), '00000000')
                                                                 AS f46_first_payment_date

FROM public.loan_applications la
JOIN public.profiles p ON la.user_id = p.id
WHERE la.status::text NOT IN (
    'STARTED', 'BUREAU_CHECKING', 'BUREAU_OK',
    'BANK_LINKING', 'AFFORD_OK', 'OFFERED'
);
