# React Zwane UI Parity Design

## Goal

Refactor every page in the modern AlgoLend React apps so the UI and user experience match ZwaneOfficial as closely as possible, while preserving AlgoLend branding, colors, data, workflows, permissions, calculations, APIs, and business logic.

The target is copy-level parity with ZwaneOfficial's visual system: layout, navigation, sidebar behavior, header behavior, cards, tables, forms, modals, badges, empty states, loading states, hover states, page transitions, chart treatment, responsive behavior, shadows, spacing, and animation rhythm. The result must look and feel like it was built from the same design system, but must not leave any Zwane branding, identity, copy, or business-specific data in AlgoLend.

## Scope

This phase targets the modern React apps only:

- `apps/admin`
- `apps/portal`

Legacy/static surfaces under `public/admin` and `public/user-portal` remain out of implementation scope for this phase. They may be used as reference material because the ZwaneOfficial repository uses those surfaces heavily, but they must not be refactored as part of this React-first migration.

## Reference Application

Reference repository:

- `https://github.com/MpumeleloTheAlgoHiver/ZwaneOfficial`

Local analysis copy:

- `/tmp/ZwaneOfficial`

Reference sources to consult during implementation:

- `/tmp/ZwaneOfficial/public/admin/src/shared/layout.js`
- `/tmp/ZwaneOfficial/public/admin/src/styles.css`
- `/tmp/ZwaneOfficial/public/admin/src/modules/dashboard.js`
- `/tmp/ZwaneOfficial/public/admin/src/modules/applications.js`
- `/tmp/ZwaneOfficial/public/admin/src/modules/users.js`
- `/tmp/ZwaneOfficial/public/admin/src/modules/settings.js`
- `/tmp/ZwaneOfficial/public/user-portal/style.css`
- `/tmp/ZwaneOfficial/public/user-portal/design-system.css`
- `/tmp/ZwaneOfficial/public/user-portal/animations.css`
- `/tmp/ZwaneOfficial/public/user-portal/layouts/navbar.css`
- `/tmp/ZwaneOfficial/public/user-portal/layouts/sidebar.css`
- `/tmp/ZwaneOfficial/public/user-portal/pages-css/*.css`

## Branding Rules

AlgoLend branding is mandatory on every React page:

- Use AlgoLend logo assets and configured company logo values.
- Use AlgoLend name and platform language.
- Use AlgoLend brand colors and theme settings through the existing theme providers.
- Use AlgoLend data and route names.
- Use AlgoLend icons or neutral product icons where the reference contains Zwane-specific assets.

No ZwaneOfficial branding, names, logos, copy, or organization-specific content may remain in the implemented React UI.

## Functional Preservation

The redesign must not change lending behavior or business logic.

Preserve:

- Supabase clients and query behavior.
- Authentication and role guards.
- Admin permissions.
- Loan/application/payment calculations.
- Credit rules and eligibility logic.
- Repayment and transaction behavior.
- Reports, analytics, and compliance data.
- Existing APIs and server contracts.
- Existing form submission flows.
- Current React-side animations and interaction effects.

All current React animations and effects are preserved unless the user explicitly approves replacing a specific duplicated decorative effect. Functional or workflow-supporting effects must remain, including coach marks, page transitions, loaders, chart animations, card entrance effects, dashboard motion, credit score motion, and mobile dock behavior.

## Admin React Page Map

All `/admin-panel` React routes are in scope.

| AlgoLend React page | Reference treatment | Migration notes |
| --- | --- | --- |
| Dashboard | Zwane admin analytics dashboard | Keep AlgoLend KPI/charts/data; match Zwane cards, chart containers, tabs, status badges, and header rhythm. |
| Applications | Zwane applications table/list | Keep filters, application statuses, actions, and navigation. Restyle table, filters, search, empty/loading states. |
| Application Detail | Zwane detail workspace | Keep application workflow actions and mutations. Restyle sections, cards, status chips, document/actions panels. |
| New Application | Zwane form flow | Keep walk-in/client creation behavior. Restyle form controls, steps, validation, buttons, and success/error states. |
| Mandates | Zwane finance/mandates page | Keep mandate operations. Restyle cards, tables, actions, and status messages. |
| Incoming Payments | Zwane payments table | Keep payment reconciliation behavior. Restyle filters, table, states, and actions. |
| Outgoing Payments | Zwane payout table/cards | Keep payout/disbursement behavior. Restyle lists, selected rows, controls, and status feedback. |
| Analytics | Zwane chart/dashboard cards | Keep analytics data. Match chart card shells, tabs, spacing, and loading/empty states. |
| Financials | Zwane financial dashboard | Keep financial data and reports. Match reference summaries, charts, and tables. |
| Credit Rules | Zwane settings/tool page | Keep rule editing behavior. Restyle cards, form rows, badges, and controls. |
| Portfolio | Zwane portfolio analytics | Keep portfolio calculations. Restyle dashboard sections and charts. |
| Loan Book | Zwane table/report page | Keep loan book data/actions. Restyle dense tables, filters, and responsive behavior. |
| Cash Ledger | Zwane ledger/table page | Keep ledger entries and mutations. Restyle table, filters, inputs, and transaction badges. |
| Settings | Zwane settings tabs/forms | Keep platform settings behavior. Add Settings subsections for General and User Management. |
| Users | Zwane users page, moved under Settings | Remove top-level `Users` nav item. Preserve user search/filter/role editing under `Settings -> User Management`. |
| Compliance routes | Zwane compliance/report pages | Keep SACRRA, validator, NCR, registers, tracker, and goAML behavior. Restyle report cards, tables, filters, actions. |

## Portal React Page Map

All `/user-portal` React routes and auth screens are in scope.

| AlgoLend React page | Reference treatment | Migration notes |
| --- | --- | --- |
| Dashboard | Zwane borrower dashboard/bento cards | Keep loan, payment, application, eligibility, and credit score logic. Preserve existing dashboard motion. |
| Apply for Loan | Zwane application workflow styling | Keep profile guard, application flow, calculations, uploads, validation, and coach/highlight effects. |
| Loan Calculator | Zwane calculator card/result style | Keep calculator rules and navigation. Restyle inputs, result cards, sliders/buttons if present. |
| Transcripts | Zwane document/report cards | Keep transcript data and actions. Restyle sections, cards, statuses, and empty states. |
| Transactions | Zwane payments/documents style | Keep transaction data. Restyle responsive tables/cards, filters, and action buttons. |
| Support | Zwane support/content page | Keep support submission behavior and compliance text. Restyle hero/header, cards, form, and feedback states. |
| Profile | Zwane profile/forms style | Keep profile completion, document/KYC sections, validations, and existing profile animations. |
| Login | Zwane auth visual language | Keep role-based redirects and auth behavior. Use AlgoLend auth imagery/settings. |
| Set Password | Zwane auth form visual language | Keep password setup behavior, validation, and redirects. |

## Navigation Design

Admin navigation must match ZwaneOfficial's sidebar/header behavior while using AlgoLend routes and labels.

Required admin nav changes:

- Remove top-level `Users`.
- Add a `Settings` group/submenu containing:
  - `General`
  - `User Management`
  - `Roles` if supported by existing functionality
  - `Permissions` if supported by existing functionality
  - `Audit Logs` if supported by existing functionality
- User Management must preserve the existing `UsersPage` search, filter, and role-edit behavior.
- Routes may use a new nested path such as `/settings/user-management`, or a tab/query-param approach inside `/settings`, as long as direct navigation and browser refresh work.

Portal navigation must match the Zwane portal visual system:

- Frosted top navigation.
- Sidebar visual treatment.
- Current mobile floating dock behavior preserved.
- Existing guarded navigation for Apply must remain.

## Design System Architecture

Use a React-facing design-system port instead of page-by-page one-off styling.

Create or refine shared primitives where useful:

- App shells.
- Page headers.
- KPI/stat cards.
- Chart cards.
- Data table wrappers.
- Filter/search toolbars.
- Badges/status pills.
- Empty states.
- Loading/skeleton states.
- Buttons.
- Inputs/selects.
- Form sections.
- Modal/dialog surfaces if needed by existing pages.

The design layer should be scoped to the React apps and must avoid broad global CSS that breaks existing behavior. Prefer shared class names and components aligned with the current codebase. Keep implementation incremental: first shared tokens/shells, then admin route groups, then portal route groups.

## Styling Direction

Match ZwaneOfficial's design language:

- Clean white/frosted surfaces.
- Subtle warm or brand-colored glow treatments, adapted to AlgoLend colors.
- Rounded card and nav surfaces matching reference proportions.
- Dense but readable admin pages.
- Bento-style borrower dashboard cards.
- Smooth hover lift and active nav states.
- Staggered page/card entrances where currently appropriate.
- Premium loading and empty states.
- Responsive desktop, tablet, and mobile layouts.

AlgoLend colors must drive:

- Buttons.
- Active nav states.
- Chart palettes.
- Badges.
- Progress bars.
- Icon accents.
- Focus states.

Accessibility requirements:

- Preserve semantic HTML where already present.
- Maintain keyboard navigation.
- Keep visible focus states.
- Maintain sufficient contrast.
- Use ARIA labels for icon-only buttons where needed.

## Performance Rules

Do not reduce performance.

Implementation should:

- Avoid duplicating large inline style blocks across pages.
- Avoid loading unused heavy libraries.
- Preserve existing React Query behavior.
- Keep chart scripts/components loaded only where needed.
- Avoid unnecessary re-renders when extracting components.
- Prefer CSS transforms/opacity for animation.
- Respect reduced-motion behavior where existing CSS supports it.

## Testing And Verification

Implementation must be verified incrementally.

Required checks:

- Run admin build: `npm run build --prefix apps/admin`.
- Run portal tests: `npm test --prefix apps/portal`.
- Run portal build: `npm run build --prefix apps/portal`.
- Browser-check representative admin routes on desktop and mobile widths.
- Browser-check representative portal routes on desktop and mobile widths.
- Confirm `Users` no longer appears as a top-level admin nav item.
- Confirm user management functionality remains accessible under Settings.
- Confirm no Zwane branding remains in React-rendered UI.
- Confirm existing portal effects remain visible, especially Apply coach/highlight behavior, dashboard card/credit motion, loaders, and mobile dock behavior.

## Out Of Scope

This phase does not:

- Rewrite backend/server routes.
- Change database schemas.
- Change Supabase security behavior.
- Refactor legacy `public/admin` or `public/user-portal` surfaces.
- Replace business calculations.
- Remove existing features.
- Add new roles/permissions/audit logs unless an equivalent feature already exists.

## Open Implementation Notes

- The repo currently has user changes in unrelated files. Implementation must preserve them and avoid reverting any user work.
- The legacy/public admin styles already match parts of ZwaneOfficial closely; use them as reference, but port carefully into React rather than copying broad CSS blindly.
- The portal React app already imports legacy CSS. Implementation should audit those imports before adding new global CSS so visual parity does not come from uncontrolled cascade conflicts.
