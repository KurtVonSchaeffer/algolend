-- Migration: contract signing hardening columns
-- Adds contract_content_hash and contract_signed_ip to loan_applications.
-- Safe to run multiple times (IF NOT EXISTS / idempotent ADD COLUMN).

alter table public.loan_applications
  add column if not exists contract_content_hash text null,
  add column if not exists contract_signed_ip     text null;
