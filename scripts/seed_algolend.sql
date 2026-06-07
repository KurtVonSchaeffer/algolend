-- AlgoLend system_settings seed
-- Run this AFTER migrate_all.sql

INSERT INTO public.system_settings (
  id,
  company_name,
  company_logo_url,
  primary_color,
  secondary_color,
  tertiary_color,
  theme_mode,
  auth_background_url,
  auth_background_flip,
  auth_overlay_color,
  auth_overlay_enabled,
  carousel_slides,
  ncr_number,
  company_reg_number,
  company_vat_number,
  company_phone,
  company_physical_address,
  company_postal_address
)
VALUES (
  'global',
  'AlgoLend',
  '/algolend-logo.svg',
  '#E7762E',
  '#F97316',
  '#FACC15',
  'light',
  null,
  false,
  '#EA580C',
  true,
  '[
    {"title":"What we stand for","text":"AlgoLend is a registered credit provider and FSP. We are committed to providing individuals and businesses with fast, fair, and secure access to credit."},
    {"title":"Who we are and what we do","text":"We provide flexible financing options, giving our customers the freedom to choose their preferred repayment period. Our pricing is transparent and fair, with no hidden fees."},
    {"title":"Customer Care","text":"We take pride in providing high-quality customer service to ensure customer satisfaction and promptly address any concerns or issues."}
  ]'::jsonb,
  'NCRCP13510',
  '2023/123456/07',
  '4012345678',
  '0691195046',
  '',
  ''
)
ON CONFLICT (id) DO UPDATE SET
  company_name            = EXCLUDED.company_name,
  company_logo_url        = EXCLUDED.company_logo_url,
  carousel_slides         = EXCLUDED.carousel_slides,
  ncr_number              = EXCLUDED.ncr_number,
  company_postal_address = EXCLUDED.company_postal_address;
