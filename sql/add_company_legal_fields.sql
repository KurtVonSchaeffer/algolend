-- =====================================================================
-- Add legal/compliance fields to system_settings
-- Add credit life + VAT fields to loan_applications
-- Run once in Supabase SQL Editor
-- =====================================================================

-- system_settings: company legal identity for DocuSeal contracts
alter table public.system_settings
  add column if not exists ncr_number          text default 'NCRCP13510',
  add column if not exists company_reg_number  text default '2023/123456/07',
  add column if not exists company_vat_number  text default '4012345678',
  add column if not exists provider_branch_code text default 'ZFS',
  add column if not exists company_phone       text default '0691195046',
  add column if not exists company_physical_address text default '',
  add column if not exists company_postal_address   text default '';

-- loan_applications: NCA fee breakdown fields
alter table public.loan_applications
  add column if not exists offer_credit_life_monthly numeric(12,2) default 0,
  add column if not exists offer_vat_amount          numeric(12,2) default 0,
  add column if not exists offer_total_cost_of_credit numeric(12,2) default 0;
