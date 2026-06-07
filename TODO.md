# TODO: complete project we need :

## Tasks
- [x] Add messaging feature
- [x] disclimer on calculator 
- [x] Logout button working 
- [x] transactions enabled
- [x] Mobile version 
- [x] guards on steps
- [x] enable webhook for didit response 
- [x] add documents , disclamers , privacy policy, user guide 
- [x] fix calculations 
- [x] get correct company details 
- [x] show file on upload screen
- [x] yah

## Current Tasks (2026-04-27)

### Audit Trail - Migration Required
- [ ] Run SQL migration: Execute `sql/add_comprehensive_audit_trail.sql` in Supabase dashboard
  - Creates 6 audit tables: audit_log, loan_state_history, user_action_log, financial_transaction_log, admin_action_audit, system_event_log
  - Adds comprehensive indexing for query performance
  - Creates recent_audit_activity view for 7-day reporting
- [ ] Alternatively: Run `node scripts/runMigration.js` with valid SUPABASE_SERVICE_ROLE_KEY

## Backlog (2026-04-26)

### Loan rules & calculations
- [x] 1st-time applicants: 1 month max term
- [x] More than 3 loans: limited to 6 (months)
- [x] Online applications limited to 6 months
- [x] Leave loan term open — admin reviews/sets loan period (COMPLETE)
- [x] Interest/fees: 5% + 15% total
- [x] First loan of the year always 5%
- [x] Remove option to set date (use system date) — already in code
- [x] Rename status "Ready" → "Approved"
- [x] In default: current balance × 3% (COMPLETE)
- [x] Service fee prorated; next month R60 (COMPLETE)
- [x] Add 0.45% (CPI?) to all loan calculations (already there)
- [ ] Add Credit Insurance Contract — line item for CPI (% calc) on all loans (display)
- [ ] Total insurance premium calculation; service fee apportioned
- [x] Make loans follow sequence referencing (ClientNumber-LoanNumber format)
- [x] Custom client reference — generated from user ID
- [x] Referencing format: Client Number - Loan Number
- [x] Agreement number generated (AGRxxxxxxxxxx)

### Truid / Contract
- [ ] Truid details should show contract logo
- [ ] Add colour for manual inserts on contract
- [ ] Purpose of the loan field
- [ ] Letters of Demand — generated per loan

### Experian / Affordability
- [x] Clients CAN input financial data (clients or consultants can input)
- [x] Track expenses (RESTORED: needed for affordability calculations)
- [x] Allow additional income + other banks (UI sections added, handlers ready)
- [ ] Tick/untick other earnings to remove from affordability check
- [x] Experian Affordability Assessment API integration (COMPLETE)
- [x] Pull current balance + everything from Experian (COMPLETE)
- [ ] Show why declined (to applicant)
- [x] Reference for credit report (Experian ref for NCR reporting) (COMPLETE)
- [ ] Product portal integration: PORTAL/EXPIRIEN.CO.ZA
- [ ] C(P or B)M payments — closed on their system but open on Compuscan
- [ ] Fix credit check

### Onboarding / Verification
- [ ] Register via WhatsApp
- [ ] Add WhatsApp SMTP
- [ ] Take a picture of the client / SMS verification
- [ ] System live date & time tracking via SMS
- [ ] Add employer verification
- [ ] Compulsory next of kin

### Banking / Payouts
- [x] Automatically upload to bank via Capitec (COMPLETE - full API integration)
- [x] CSV should include bank accounts etc (COMPLETE)
- [x] Lock CSV on download (COMPLETE - SHA256 integrity checking)
- [x] CSV format spec (TBD) (IMPLEMENTED - batch ID, method, record count, total amount)
- [x] Payout: use current primary bankout logic (COMPLETE - auto-selects Capitec for primary accounts)
- [x] CashSend has extra fees — logic to choose which account from CashSend payout (COMPLETE)
- [x] Choose specific payment method (COMPLETE - Capitec, CashSend, Third-party, Cash)
- [x] CashSend fee structure (COMPLETE - configurable base + percentage)
- [x] Payout to client / third party (COMPLETE - full support in schema and API)

### Audit & Cash
- [ ] Deeper audit trail
- [ ] Audit trail of cash
- [ ] Request for the day → then add journal
- [ ] Cash Ledger under Analytics — no editing
- [ ] Track client activity
- [ ] Solve back-dating + payment history
- [ ] Backdating with SACRRA

### Analytics & Reporting
- [x] Financials by branch (COMPLETE - financial report endpoint)
- [x] Time filters (down to days) for incoming payments (COMPLETE - date filtering on analytics)
- [x] Outgoing full comparisons + downloadable (COMPLETE - payment report endpoint)
- [ ] All online applications routed to head office
- [ ] Export all pages data
- [ ] Move loan book — analysis
- [x] Export dashboard (COMPLETE - comprehensive dashboard metrics endpoint)

### Client management
- [ ] Be able to cap specific clients
- [ ] Client-specific data
- [ ] Use agent logic from Flexi

