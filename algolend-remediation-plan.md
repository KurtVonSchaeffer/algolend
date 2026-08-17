# AlgoLend Pre-Launch Remediation Checklist

Generated: 2026-08-17  
Supabase project: `zpaqzzheqtrufemhpijn`

---

## CRITICAL — Fix before any borrower traffic

### 1. TruID — REMOVED (2026-08-17)
> TruID API is defunct. All routes, service file, and frontend calls removed.
> Bank statement verification now relies solely on PDF upload (manual upload flow).
> AI credit scoring system (Phase 2 below) replaces TruID's income analysis role.

- [x] Deleted `services/truidService.js`
- [x] Removed `/api/truid/*` and `/api/banking/*` routes from `server.js`
- [x] Removed TruID status fetch from `apply-loan.js`
- [x] Rewrote `bankstatement.js` — manual upload only, no TruID connect flow
- [x] Deleted `sql/truid_collections.sql`, `sql/truid_bank_snapshots.sql` (never ran, now obsolete)
- [x] `TRUID_API_KEY`, `COMPANY_ID`, `BRAND_ID`, `TRUID_WEBHOOK_SECRET` — not needed

### 2. Run `document_uploads` migration
> Upload controllers and the document service frontend read/write this table.
> It never existed in the DB — all document upload tracking has been silently failing.

- [x] Run: `migrations/20260817_document_uploads.sql` against project `zpaqzzheqtrufemhpijn` — applied 2026-08-17, FK removed (plain bigint null)
- [ ] Smoke-test: upload a bank statement and confirm a row appears in `document_uploads`

### 3. AI credit scoring system — DONE (2026-08-17)
> Gemini 1.5 Flash extracts feature vector from bank statement PDF →
> deterministic scorecard (0–850) → stores features + score + outcome in DB.
> Fires automatically on every PDF bank statement upload (non-blocking trigger).

- [x] `services/creditFeatures.js` — Gemini REST extraction (no new npm deps)
- [x] `services/creditScoreEngine.js` — deterministic scorecard, 5 components, 0–850
- [x] `services/creditScoringPipeline.js` — orchestrates extraction + scoring + DB writes
- [x] Routes: `POST /api/credit-score/analyze` (on-demand re-score), `GET /api/credit-score/:applicationId`
- [x] Migrations applied: `credit_features`, `credit_scores`, `credit_outcomes` (all RLS-enabled)
- [x] `loan_applications.ai_credit_score` + `ai_credit_band` columns added
- [x] `bankStatementController.js` — fires pipeline on PDF upload (setImmediate, non-blocking)
- [x] `GEMINI_API_KEY` added to Vercel production env (2026-08-17)

### 4. Other env vars confirmed missing from Vercel
- [ ] `CSV_DOWNLOAD_PIN` — Capitec CSV endpoint returns 500 if unset (default '1234' was removed in Phase 5)
- [x] `DOCUSEAL_WEBHOOK_SECRET` — no longer needed; DocuSeal routes fully removed (2026-08-17)

---

## HIGH — Fix before go-live

### 3. Remove dead DocuSeal routes — DONE (2026-08-17)
> All `/api/docuseal/*` routes, the DocuSeal auth middleware, constants
> (`DOCUSEAL_API_KEY`, `DOCUSEAL_TEMPLATE_ID`, `isDocuSealReady`), and helper
> functions (`docuSealRequest`, `buildDocuSealSubmission`, `handleDocuSealError`)
> removed from `server.js`. `rawBody` capture in `express.json` verify also removed.
> `DOCUSEAL_WEBHOOK_SECRET` env var no longer needed.

- [x] Deleted `// DocuSeal proxy endpoints` block (all `/api/docuseal/*` routes)
- [x] Removed DocuSeal auth middleware (`app.use('/api/docuseal', ...)`)
- [x] Removed DocuSeal constants + helper functions
- [x] `node --check server.js` passes (no syntax errors)
- [x] `/api/docuseal/config` returns 404 — routes fully removed, no code to reach

### 4. Native signing flow hardening — DONE (2026-08-17)

- [x] SHA-256 content hash of signed HTML stored in `loan_applications.contract_content_hash` — tamper evidence
- [x] `audit_log` entry written on signing (`CONTRACT_SIGNED` action, includes hash + IP)
- [x] `req.ip` captured at signing, stored in `loan_applications.contract_signed_ip`
- [x] Migration run: `migrations/20260817_contract_signing_columns.sql` (both columns added to `loan_applications`)
- [ ] Check: failed SureSystems mandate activation leaves `contract_signed_at` set but no mandate loaded — logged as warning, non-fatal; confirm admin UI surfaces the mandate_failed state so ops can retry manually

### 5. Credential rotation — confirm completion
> Keys from the original `.env` exposure must be confirmed rotated in each
> provider's dashboard, not just assumed done.

- [x] DocuSeal: N/A — integration fully removed, in-house signing replaces it
- [x] Supabase: old compromised project removed from codebase; active project is `zpaqzzheqtrufemhpijn`
- [x] Didit: current key in Vercel confirmed as live key to use

---

## MEDIUM — Run before sustained load

### 6. SQL migration: section-129 send_failed flag — DONE (2026-08-17)
- [x] `section129_send_failed boolean NOT NULL DEFAULT false` confirmed in `loan_applications`

### 7. SQL migration: performance indexes — DONE (2026-08-17)
- [x] All indexes applied (loan_applications, profiles, audit_log, and optional tables)
- [x] Note: `loan_applications` uses `client_id` (not `user_id`) as borrower reference in live schema — indexes corrected accordingly

---

## LOW — Pre-scale, not pre-launch

### 8. Connection pooling / PgBouncer
> Flagged "not done" in the last full route audit. Fine for a modest user base;
> becomes a problem under concurrent load.

- [ ] Evaluate whether Supabase's built-in pooler (port 6543, transaction mode) is sufficient, or whether a dedicated PgBouncer instance is needed
- [ ] Switch `DATABASE_URL` to pooler endpoint if not already done

### 9. Mobile readiness audit
> Separate, unstarted track. Not blocking launch for desktop users.

- [ ] Run mobile readiness audit (prompt exists from earlier in this conversation)
- [ ] Test borrower portal on iOS Safari and Android Chrome (viewport, touch targets, file upload)

---

### 10. loan_applications schema parity — DONE (2026-08-17)
> Live DB had ZwaneOfficial B2B schema (client_id, borrower_id, no offer_*).
> server.js expects AlgoLend consumer schema. ~45 columns were missing — all
> server.js queries against loan_applications were silently returning empty
> results or erroring in production.

- [x] `user_id uuid` added + backfilled from `client_id` (existing rows preserved)
- [x] All `offer_*` pricing columns added
- [x] All `credit_*` decision columns added
- [x] All `affordability_*` + NCA compliance columns added
- [x] All `pep_sanctions_*` FICA columns added
- [x] All `contract_*` signing columns added (joining what was already added)
- [x] `section129_*`, `kyc_status`, `source`, `bank_account_id` added
- [x] Migration: `migrations/20260817_loan_applications_parity.sql` applied

---

## Closed / confirmed done

- [x] Phase 4: 12 auth gaps closed, credential logging removed
- [x] Phase 5: RBAC privilege escalation (requireAdminAuth + user_metadata fallback) — 22 occurrences patched across server.js and all client-side apps
- [x] TruID webhook: mandatory HMAC via `TRUID_WEBHOOK_SECRET` (code in place, env var still needed)
- [x] DocuSeal webhook: mandatory HMAC — no silent passthrough if secret unset
- [x] Capitec CSV: default PIN '1234' removed — hard 500 if `CSV_DOWNLOAD_PIN` unset
- [x] `const band` → `let band` bug fix (credit cap override was silently failing)
- [x] `typeLabel` → `typeStr` bug fix (cash journal entries were silently failing)
- [x] NCA affordability endpoint hardened — ignores caller-supplied rates, sources from `credit_score_bands`
- [x] Section-129 `send_failed` flag added to cron (migration still needs running — see item 6)
- [x] `public/user/` standalone Express app (port 5001) deleted — dead-but-reachable server removed
- [x] Upload controllers (tillSlip, bankStatement, idcard): auth moved to top, ownership checks added, hardcoded user IDs removed
- [x] ECT Act / in-app signing legality: canvas draw-to-sign is valid basic electronic signature for NCA credit agreements — confirmed
