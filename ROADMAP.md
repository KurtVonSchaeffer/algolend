# Main Site Roadmap — features/update

Captured 2026-04-26. User-facing site (not SACRRA admin).

## Lending rules
- 1st time applicants: 1 month max
- More than 3 loans: limited to 6 months
- Limit online to 6 months
- "Leave open" → admin reviews loan period
- 5% + 15% total interest rate and fees
- First loan of the year is always 5%
- Remove the option to set date
- Change "ready" → "approved"
- Backdating with SACRRA
- Agreement number must match Max Money
- In default: current balance × 3%
- Service fee prorated
- Total insurance premium calculation; service fee apportioned, next month R60
- Add 0.45% to calculations

## Truid / Experian
- Truid details should show
- Clients cannot input financial data — use Experian for all details
- Consultant inputs all details
- Show required figures
- Clients can add additional income and other banks
- We don't care about expenses
- Tick/untick other earnings to remove from affordability check
- ProductPORTAL / EXPIRIEN.CO.ZA — Experian affordability assessment
- Show why they declined
- Reference for credit report (proof to NCR that reporting was done)
- Pull current balance + everything possible from Experian
- C(P or B) M payments — closed on their system but open on Compuscan
- Fix credit check

## Contracts & documents
- Contract logo
- Add Credit Insurance Contract — line item for CPI (% calc) added to all loan calculations
- Add colour for manual inserts on contract
- Letters of Demand — generated per loan
- Purpose of the loan
- Compulsory next of kin
- Add employer verification

## Banking / payouts
- Automatically upload to bank via Capitec
- CSV should have bank accounts etc.
- Loans must follow sequence referencing
- Custom client reference — keep same as current book
- Lock the CSV on download
- CSV format
- Payout uses current primary bank-out logic
- Cashsend has extra fees — logic to choose which account from Cashsend payout
- Choose specific payment method
- Cashsend fee structure
- Payout to client / third party
- Referencing: Client Number – Loan Number

## Verification & comms
- Add WhatsApp SMTP
- Register via WhatsApp
- SMS verification — take a picture of the client
- Live date/time tracking via SMS
- Tracking days

## Audit / analytics
- Deeper audit trail
- Audit trail of cash
- Request for the day, then add journal
- Under Analytics (Cash Ledger): no editing
- Financials by branch
- Time filters up to days for incoming payments
- Outgoing: full comparisons + downloadable
- All online applications to head office
- Export All Pages Data
- Export Dashboard
- Move loan book — analysis
- Track client activity
- Solve back-dating — payment history
- Use agent logic from Flexi

## Client management
- Be able to cap specific clients
- Client-specific data

## Notes / regulatory flags
- POPIA: client photo + SMS tracking — needs explicit consent flow
- NCA: default 3% rule, service fee prorating, insurance premium math — verify against contracts
- SACRRA backdating must not break bureau reporting accuracy
- Reference number scheme migration: needs a plan, not just code change
