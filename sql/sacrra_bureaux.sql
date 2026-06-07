-- ════════════════════════════════════════════════════════════════
-- SACRRA Bureau Configuration
-- One row per bureau (Experian, TransUnion, XDS, Compuscan)
-- Run once in Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.sacrra_bureaux (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bureau_key          text UNIQUE NOT NULL,   -- 'experian' | 'transunion' | 'xds' | 'compuscan'
    bureau_name         text NOT NULL,           -- Display name
    is_enabled          boolean DEFAULT true,

    -- Identification (each bureau issues their own SRN)
    supplier_ref_number text,                    -- 10-char SRN issued by bureau
    pgp_public_key      text,                    -- Bureau's PGP public key for encryption

    -- Submission method
    submission_method   text NOT NULL DEFAULT 'email' CHECK (submission_method IN ('moveit','email','sftp')),
    submission_email    text,                    -- For 'email' method — where to send the .pgp file
    submission_host     text,                    -- For 'sftp' method
    submission_username text,
    submission_password text,                    -- Encrypted at rest by Supabase
    submission_folder   text,                    -- Upload folder ID/path

    -- Last submission tracking
    last_submitted_at   timestamptz,
    last_submission_status text,                 -- 'success' | 'failed' | 'pending'
    last_submission_note   text,

    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

-- Seed the 4 bureaux (idempotent)
INSERT INTO public.sacrra_bureaux (bureau_key, bureau_name, submission_method, submission_email) VALUES
    ('experian',   'Experian',    'moveit', NULL),
    ('transunion', 'TransUnion',  'email',  NULL),
    ('xds',        'XDS',         'email',  NULL),
    ('compuscan', 'Compuscan',   'email',  NULL)
ON CONFLICT (bureau_key) DO NOTHING;

ALTER TABLE public.sacrra_bureaux ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON public.sacrra_bureaux;
CREATE POLICY "service_role_all" ON public.sacrra_bureaux FOR ALL USING (true);
