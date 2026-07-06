# React User-Portal Rewrite — Design

**Date:** 2026-07-03
**Status:** Approved
**Scope:** Phase 1 of the AlgoLend React migration — auth + user portal only

## Background & goals

AlgoLend's frontend is vanilla JS: a Vite multi-page admin portal (23 pages, ~18k lines), a static user portal (13 pages + 9 HTML modules, ~15k lines of JS), and an auth flow — all served by an Express server (`server.js`, 158 API endpoints) that holds the business logic (SACRRA, payments, DocuSeal, credit checks). ZwaneOfficial parity is no longer a constraint: Zwane was the prototype; AlgoLend is the product going forward.

Goals, in priority order:
1. Better UI/UX while porting (modern components, cleaner flows)
2. Modern stack (React + TypeScript)
3. Easier future development (typed API layer, reusable components, tests)

**Decisions made:**
- Frontend-only rewrite. The Express backend stays byte-for-byte as-is; a later, separate project may split it into typed modules.
- User portal + auth first; admin portal is a later, separate project that reuses the component library.
- Vite + React SPA served as static files by the existing Express server (same pattern as today's admin build). Not Next.js — everything is behind login, SSR/SEO buys nothing, and one deployment is simpler.
- Rebuild the portal as one new app and cut over when complete (no per-page strangler, no big-bang portal+admin).

## Constraints discovered in the current code

- **URL contract:** emails, web-push notifications, and `server.js` itself generate links of the form `/user-portal/?page=dashboard`, `?page=payments`, `?page=sign-contract`. These URLs must keep working forever.
- **Backend imports portal code:** `server.js` requires `public/user-portal/Services/kycService`. The legacy portal folder cannot be deleted until this file moves to `services/` (behavior-neutral move, part of cutover).
- **Runtime theming:** branding (colors, logo, legal entity, carousel) comes from the `system_settings` DB row via `/api/system-settings` and is applied as CSS variables (`--color-primary` etc.) by `public/shared/theme-runtime.js`. Rebranding via the admin Settings page must keep working without a rebuild.
- **PWA surface:** the portal registers a service worker (`sw.js`) and web-push subscriptions. Both must survive the rewrite.

## Architecture

New app at **`apps/portal/`** (source lives outside `public/` so the legacy portal keeps running untouched during the rewrite):

- **Vite + React 18 + TypeScript**
- **React Router** with one route per current page (`/user-portal/dashboard`, `/user-portal/payments`, …) plus a redirect shim that maps `?page=X` to the matching route
- **Tailwind CSS + shadcn/ui** for components, themed by the existing CSS variables
- **TanStack Query** for all server state (caching, loading/error states)
- **Supabase JS** for the auth session, exactly as today (localStorage persistence, JWT sent to Express)
- Builds to `apps/portal/dist`; committed like the admin dist (Vercel build pattern)

**Express change (small):** serve `/user-portal` and `/auth` from `apps/portal/dist` when it exists, falling back to the legacy folders. Rollback is a one-line revert. The API surface (158 endpoints) does not change.

The app contains the auth screens (login, signup, forgot-password, set-password) and all 22 portal pages/modules.

## Theming

A `ThemeProvider` fetches `/api/system-settings` (same endpoint, same payload) and sets the same CSS variables on `:root` that `theme-runtime.js` sets today. Tailwind's palette and shadcn/ui tokens are configured to read those variables, so:
- the purple AlgoLend brand renders with zero hardcoded colors in components,
- live rebranding from the admin Settings page keeps working,
- the future admin rewrite inherits the mechanism unchanged.

## Page inventory & migration order

| Slice | Contents |
|---|---|
| 1. Shell + auth | login/signup/forgot/set-password, session guard, navbar/sidebar layout, ThemeProvider, service-worker + push registration |
| 2. Read-mostly pages | dashboard, loan-calculator, notifications, support, transcripts, documents, profile |
| 3. Payments | payment schedule, history, statements |
| 4. Apply-loan wizard | apply-loan 1/2/3, loan-config, credit-check, KYC, banking form, ID card / bank statement / till slip uploads, edit-application, confirmation, sign-contract |

The current 3-page + 9-module application flow becomes **one React wizard component with steps**: same screens, same API calls, but state held in one place instead of sessionStorage handoffs between HTML files.

UI is upgraded per page as it is ported: shadcn/ui primitives (forms, dialogs, toasts, tables, skeleton loaders) with the same layout logic.

## Data layer

- `api/client.ts`: one typed fetch wrapper attaching the Supabase JWT and handling 401 → login redirect (React equivalent of `apiFetch.js`).
- Every portal endpoint gets a typed function plus a TanStack Query hook (`useLoans()`, `usePayments()`, `useSystemSettings()`, …). Components never call `fetch` directly.

## Error handling

- Query/mutation errors surface as shadcn toasts + inline error states (replacing `alert()`s).
- A top-level error boundary catches render crashes with a reload screen.
- The wizard never trusts client state after a failed mutation: the server remains source of truth and steps re-fetch on entry, so a failed submit cannot strand a half-submitted application.

## Testing

- **Vitest + React Testing Library** for the wizard step logic and the API client (the risk-bearing code).
- **Playwright smoke suite** (login → dashboard → start application → payments) against the local Express server, run before cutover. Playwright is already a dev dependency.
- Manual side-by-side check (React page vs legacy page) as each page lands.

## Phases & cutover

1. **Phase 1:** scaffold `apps/portal`, ThemeProvider, API client, auth screens + shell; verify locally against Express
2. **Phases 2–4:** page slices in inventory order, browser-verified as they land
3. **Cutover:** root `build` script builds portal + admin; Express serves the React dist at `/user-portal` + `/auth`; `kycService` moves to `services/`; legacy folders remain in the repo for one release as instant rollback, then are deleted

## Out of scope

- Any backend/API change (beyond the static-serving switch and the `kycService` file move)
- Admin portal rewrite (later project, reuses the component library)
- DB/schema changes, new features, TypeScript-ing the Express server
