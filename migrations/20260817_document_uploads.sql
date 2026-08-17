-- =============================================================================
-- Migration: document_uploads
-- Derived from: documentService.js, transcripts.js, apply-loan.js,
--               bankStatementController.js, idcardController.js,
--               tillSlipController.js.
-- Run via Supabase MCP apply_migration against project zpaqzzheqtrufemhpijn.
-- Safe to run multiple times — all statements are idempotent.
-- =============================================================================
--
-- Written by:
--   - transcripts.js (authenticated frontend): INSERT with user_id, file_name,
--     file_type, file_path only (no application_id, no mime_type, no file_size).
--   - Upload controllers (service role): INSERT with full payload including
--     original_name, mime_type, file_size, application_id.
--
-- Read by:
--   - documentService.js (authenticated frontend): SELECT by user_id+file_type,
--     by application_id+file_type. Columns: id, file_name, uploaded_at, status,
--     file_type.
--   - transcripts.js (authenticated frontend): SELECT by user_id, file_type IN
--     ('till_slip','bank_statement'). Columns: id, file_name, file_type,
--     file_path, uploaded_at.
--   - Upload controllers (service role): SELECT by user_id+file_type.
--
-- file_type known values: 'till_slip', 'bank_statement', 'id_card_front', 'id_card_back'

create table if not exists public.document_uploads (
  id            uuid        not null default gen_random_uuid() primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  -- loan_applications.id is uuid. FK set to ON DELETE SET NULL so uploads
  -- survive if an application is deleted.
  application_id uuid       null references public.loan_applications(id) on delete set null,
  file_name     text        not null,
  original_name text        null,   -- set by backend upload controllers; frontend omits this
  file_type     text        not null,
  file_path     text        not null,
  mime_type     text        null,   -- set by backend upload controllers; frontend omits this
  file_size     integer     null default 0,
  status        text        not null default 'uploaded',
  uploaded_at   timestamptz not null default now()
);

-- Primary lookup: checkDocumentExistsByUser(userId, fileType) — filters (user_id, file_type), orders by uploaded_at DESC
create index if not exists idx_document_uploads_user_file_type
  on public.document_uploads (user_id, file_type, uploaded_at desc);

-- Legacy application-scoped lookup: checkDocumentExists(applicationId, fileType)
create index if not exists idx_document_uploads_application_id
  on public.document_uploads (application_id) where application_id is not null;

-- Ordering fallback
create index if not exists idx_document_uploads_uploaded_at
  on public.document_uploads (uploaded_at desc);

alter table public.document_uploads enable row level security;

-- Service role: full access (upload controllers write via SUPABASE_SERVICE_ROLE_KEY)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'document_uploads'
      and policyname = 'service role full access on document_uploads'
  ) then
    create policy "service role full access on document_uploads"
      on public.document_uploads
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- Authenticated borrowers: read own upload records.
-- documentService.js and transcripts.js both read by user_id.
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'document_uploads'
      and policyname = 'authenticated can read own document_uploads'
  ) then
    create policy "authenticated can read own document_uploads"
      on public.document_uploads
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

-- Authenticated borrowers: insert own upload records.
-- transcripts.js inserts directly (not via the API upload route).
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'document_uploads'
      and policyname = 'authenticated can insert own document_uploads'
  ) then
    create policy "authenticated can insert own document_uploads"
      on public.document_uploads
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;
