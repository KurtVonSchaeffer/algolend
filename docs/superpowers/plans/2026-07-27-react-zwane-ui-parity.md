# React Zwane UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign every page in `apps/admin` and `apps/portal` so AlgoLend matches ZwaneOfficial's UI/UX system while keeping AlgoLend branding, colors, business logic, data flows, and existing effects.

**Architecture:** Port the Zwane visual system into React-scoped design primitives, then migrate route groups incrementally. Preserve existing Supabase services, React Query calls, calculations, auth guards, and page workflows; only change shell structure, route placement, reusable UI primitives, CSS, and presentation markup.

**Tech Stack:** React 18, TypeScript, Vite, React Router, React Query, Tailwind CSS, existing CSS modules/global styles, Vitest for portal tests, Vite build verification for admin.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-07-27-react-zwane-ui-parity-design.md`
- Reference admin layout: `/tmp/ZwaneOfficial/public/admin/src/shared/layout.js`
- Reference admin styles: `/tmp/ZwaneOfficial/public/admin/src/styles.css`
- Reference admin dashboard: `/tmp/ZwaneOfficial/public/admin/src/modules/dashboard.js`
- Reference portal design system: `/tmp/ZwaneOfficial/public/user-portal/design-system.css`
- Reference portal animations: `/tmp/ZwaneOfficial/public/user-portal/animations.css`
- Reference portal navbar/sidebar: `/tmp/ZwaneOfficial/public/user-portal/layouts/navbar.css`, `/tmp/ZwaneOfficial/public/user-portal/layouts/sidebar.css`

## Dirty Worktree Rule

Before every task, run `git status --short`. The current workspace has user changes outside this plan. Do not revert, overwrite, or stage unrelated files. Stage only the files listed in each task.

## File Structure

### Admin

- Create `apps/admin/src/components/ui/AdminPage.tsx`: shared page header, toolbar, section, stat card, chart card, empty state, loading block, status badge, and table shell components.
- Create `apps/admin/src/layout/adminNav.ts`: declarative nav model with `Settings -> General` and `Settings -> User Management`.
- Modify `apps/admin/src/layout/AdminLayout.tsx`: consume nav model, match Zwane sidebar/header behavior, remove top-level Users, preserve sign out, notifications, avatar, theme logo.
- Modify `apps/admin/src/App.tsx`: add `/settings/user-management`, keep legacy `/users` as a redirect to avoid broken bookmarks, update page titles.
- Modify `apps/admin/src/pages/SettingsPage.tsx`: support a `section` prop or route-aware section mode for General and User Management.
- Modify `apps/admin/src/pages/UsersPage.tsx`: accept `embedded` and `title` props so it can render inside Settings without duplicating logic.
- Modify every admin page under `apps/admin/src/pages/*.tsx`: replace ad hoc wrappers with shared primitives and Zwane-style class names while preserving service calls and handlers.
- Modify `apps/admin/src/index.css`: add React admin Zwane parity tokens and shared component classes.

### Portal

- Create `apps/portal/src/components/ui/PortalPage.tsx`: shared portal page shell, bento grid, card, section header, action card, empty state, loading block, and status badge components.
- Modify `apps/portal/src/layout/PortalLayout.tsx`: preserve existing navigation logic and mobile dock behavior while aligning shell styling with Zwane.
- Modify `apps/portal/src/index.css` and selected `apps/portal/src/legacy-css/*.css`: tighten AlgoLend-colored Zwane parity styles without broad cascade regressions.
- Modify all portal pages under `apps/portal/src/pages/*.tsx`: use shared wrappers where safe; keep queries, calculations, event handlers, and effects intact.
- Modify `apps/portal/src/auth/AuthPage.tsx` and `apps/portal/src/auth/SetPasswordPage.tsx`: match Zwane auth visual language with AlgoLend settings and existing redirects.

---

### Task 1: Baseline Audit And Safety Snapshot

**Files:**
- Read only: `apps/admin/src/App.tsx`
- Read only: `apps/admin/src/layout/AdminLayout.tsx`
- Read only: `apps/admin/src/index.css`
- Read only: `apps/portal/src/App.tsx`
- Read only: `apps/portal/src/layout/PortalLayout.tsx`
- Read only: `apps/portal/src/index.css`
- Read only: `apps/portal/src/legacy-css/index.ts`
- Read only: `docs/superpowers/specs/2026-07-27-react-zwane-ui-parity-design.md`

- [ ] **Step 1: Record current worktree**

Run:

```bash
git status --short
```

Expected: existing unrelated user changes may appear. Do not stage them.

- [ ] **Step 2: Capture current React route list**

Run:

```bash
rg -n "<Route|path=" apps/admin/src/App.tsx apps/portal/src/App.tsx
```

Expected: all admin and portal routes listed, including `/admin-panel` basename and `/user-portal` routes.

- [ ] **Step 3: Capture current UI class usage**

Run:

```bash
rg -n "page-header|chart-card|admin-table|nav-link|dashboard-container|luma-|card|modal|spinner" apps/admin/src apps/portal/src
```

Expected: existing class names visible. Use the output to avoid renaming classes that are already tied to behavior.

- [ ] **Step 4: Verify baseline admin build**

Run:

```bash
npm run build --prefix apps/admin
```

Expected: build succeeds before UI changes. If it fails from pre-existing user edits, record the exact error in the task notes and continue only with files unaffected by that failure.

- [ ] **Step 5: Verify baseline portal tests and build**

Run:

```bash
npm test --prefix apps/portal
npm run build --prefix apps/portal
```

Expected: tests and build succeed before UI changes. If they fail from pre-existing user edits, record exact failing tests/errors and avoid claiming the redesign introduced or fixed them.

- [ ] **Step 6: Commit**

No commit for this audit task unless files were intentionally changed. If no files changed, mark the task complete in notes.

---

### Task 2: Admin Navigation Model And Route Tests

**Files:**
- Create: `apps/admin/src/layout/adminNav.ts`
- Modify: `apps/admin/src/App.tsx`
- Modify: `apps/admin/src/layout/AdminLayout.tsx`
- Modify: `apps/admin/src/pages/SettingsPage.tsx`
- Modify: `apps/admin/src/pages/UsersPage.tsx`

- [ ] **Step 1: Write a failing static route/navigation check**

Create a temporary verification script at `/tmp/check-admin-nav.mjs` with this content:

```js
import fs from 'node:fs';
import path from 'node:path';

const root = '/Users/kurtvonschaeffer/Algolend';
const app = fs.readFileSync(path.join(root, 'apps/admin/src/App.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'apps/admin/src/layout/AdminLayout.tsx'), 'utf8');
const navPath = path.join(root, 'apps/admin/src/layout/adminNav.ts');
const nav = fs.existsSync(navPath) ? fs.readFileSync(navPath, 'utf8') : '';

const checks = [
  ['adminNav exists', fs.existsSync(navPath)],
  ['settings user management route exists', app.includes('settings/user-management')],
  ['legacy users route redirects', app.includes('path="users"') && app.includes('settings/user-management')],
  ['top-level Users href removed from layout', !layout.includes("href: '/users'")],
  ['nav model includes User Management', nav.includes('User Management')],
  ['nav model does not expose top-level Users', !/section:\s*['"]Finance['"][\s\S]*label:\s*['"]Users['"]/.test(nav)],
];

const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error(failed.map(([name]) => `FAIL ${name}`).join('\n'));
  process.exit(1);
}
console.log('admin navigation checks passed');
```

- [ ] **Step 2: Run the check to verify it fails**

Run:

```bash
node /tmp/check-admin-nav.mjs
```

Expected: FAIL for missing `adminNav`, missing `settings/user-management`, and current top-level Users exposure.

- [ ] **Step 3: Create the admin nav model**

Create `apps/admin/src/layout/adminNav.ts`:

```ts
export interface AdminNavItem {
  href: string;
  icon: string;
  label: string;
}

export interface AdminNavSubmenu {
  id: string;
  label: string;
  icon: string;
  children: AdminNavItem[];
}

export interface AdminNavGroup {
  section: string;
  items: AdminNavItem[];
  submenu?: AdminNavSubmenu;
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    section: 'Overview',
    items: [{ href: '/dashboard', icon: 'dashboard', label: 'Dashboard' }],
    submenu: {
      id: 'analytics',
      label: 'Analytics',
      icon: 'bar_chart',
      children: [
        { href: '/analytics', icon: 'analytics', label: 'Customer Analytics' },
        { href: '/financials', icon: 'account_balance', label: 'Financials' },
      ],
    },
  },
  {
    section: 'Applications',
    items: [
      { href: '/applications', icon: 'assignment', label: 'Applications' },
      { href: '/create-application', icon: 'add_circle', label: 'New Application' },
    ],
  },
  {
    section: 'Finance',
    items: [{ href: '/mandates', icon: 'receipt_long', label: 'Mandates' }],
    submenu: {
      id: 'payments',
      label: 'Payments',
      icon: 'payments',
      children: [
        { href: '/incoming-payments', icon: 'south_west', label: 'Incoming' },
        { href: '/outgoing-payments', icon: 'north_east', label: 'Outgoing' },
      ],
    },
  },
  {
    section: 'Tools',
    items: [
      { href: '/credit-rules', icon: 'rule', label: 'Credit Rules' },
      { href: '/portfolio', icon: 'analytics', label: 'Portfolio' },
      { href: '/loan-book', icon: 'menu_book', label: 'Loan Book' },
      { href: '/cash-ledger', icon: 'account_balance_wallet', label: 'Cash Ledger' },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { href: '/sacrra', icon: 'verified_user', label: 'SACRRA' },
      { href: '/sacrra-validator', icon: 'rule_folder', label: 'Migration Validator' },
      { href: '/ncr-reporting', icon: 'assignment', label: 'NCR Reporting' },
      { href: '/ncr-registers', icon: 'manage_accounts', label: 'NCR Registers' },
      { href: '/compliance-tracker', icon: 'checklist', label: 'Compliance Tracker' },
      { href: '/goaml', icon: 'security', label: 'FIC goAML' },
    ],
  },
  {
    section: 'Settings',
    items: [],
    submenu: {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      children: [
        { href: '/settings', icon: 'tune', label: 'General' },
        { href: '/settings/user-management', icon: 'group', label: 'User Management' },
      ],
    },
  },
];

export function getExpandedNavIds(pathname: string): Record<string, boolean> {
  return {
    analytics: pathname.includes('/analytics') || pathname.includes('/financials'),
    payments: pathname.includes('/incoming-payments') || pathname.includes('/outgoing-payments'),
    settings: pathname.includes('/settings'),
  };
}
```

- [ ] **Step 4: Update `AdminLayout.tsx` to consume `ADMIN_NAV`**

Remove the inline `NAV` constant from `apps/admin/src/layout/AdminLayout.tsx`, import `ADMIN_NAV` and `getExpandedNavIds`, and change the existing auto-expand effect to:

```ts
useEffect(() => {
  setExpanded(prev => ({ ...prev, ...getExpandedNavIds(location.pathname) }));
}, [location.pathname]);
```

Then replace `NAV.map(group => (` with `ADMIN_NAV.map(group => (`. Keep the existing sign-out, notification dropdown, avatar, logo, and mobile sidebar state logic intact.

- [ ] **Step 5: Add Settings/User Management routing**

In `apps/admin/src/App.tsx`, change the imports to keep `UsersPage`, add page titles:

```ts
settings: 'Settings',
'settings/user-management': 'User Management',
users: 'User Management',
```

Then add the route:

```tsx
<Route path="settings/user-management" element={<SettingsPage section="user-management" />} />
<Route path="users" element={<Navigate to="/settings/user-management" replace />} />
```

Keep `<Route path="settings" element={<SettingsPage />} />`.

- [ ] **Step 6: Embed Users in Settings**

Change the Settings page signature:

```ts
export function SettingsPage({ section = 'general' }: { section?: 'general' | 'user-management' }) {
```

Import `UsersPage` in `SettingsPage.tsx`. Initialize the tab from the section:

```ts
const [tab, setTab] = useState(section === 'user-management' ? 'User Management' : 'Branding');
```

Extend `TABS`:

```ts
const TABS = ['Branding', 'Theme', 'Auth Page', 'Legal', 'User Management'];
```

Add this render block below the Legal block:

```tsx
{tab === 'User Management' && (
  <UsersPage embedded title="User Management" />
)}
```

Update `UsersPage` signature:

```ts
export function UsersPage({ embedded = false, title = 'Users' }: { embedded?: boolean; title?: string }) {
```

Wrap its header so it is omitted when embedded:

```tsx
{!embedded && (
  <div className="page-header">
    <div>
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{users.length} registered users</p>
    </div>
  </div>
)}
```

When `embedded` is true, show the result count near the filter toolbar as it already does.

- [ ] **Step 7: Verify the navigation check passes**

Run:

```bash
node /tmp/check-admin-nav.mjs
```

Expected: `admin navigation checks passed`.

- [ ] **Step 8: Build admin**

Run:

```bash
npm run build --prefix apps/admin
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 9: Commit**

Run:

```bash
git add apps/admin/src/layout/adminNav.ts apps/admin/src/layout/AdminLayout.tsx apps/admin/src/App.tsx apps/admin/src/pages/SettingsPage.tsx apps/admin/src/pages/UsersPage.tsx
git commit -m "feat: move admin users into settings navigation"
```

---

### Task 3: Admin Shared Zwane-Style Primitives

**Files:**
- Create: `apps/admin/src/components/ui/AdminPage.tsx`
- Modify: `apps/admin/src/index.css`

- [ ] **Step 1: Write a failing static component check**

Create `/tmp/check-admin-primitives.mjs`:

```js
import fs from 'node:fs';
const file = '/Users/kurtvonschaeffer/Algolend/apps/admin/src/components/ui/AdminPage.tsx';
const css = '/Users/kurtvonschaeffer/Algolend/apps/admin/src/index.css';
const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const styles = fs.readFileSync(css, 'utf8');
const required = [
  'AdminPageShell',
  'AdminPageHeader',
  'AdminToolbar',
  'AdminStatCard',
  'AdminChartCard',
  'AdminTableShell',
  'AdminEmptyState',
  'AdminLoadingBlock',
  'AdminStatusBadge',
  'admin-z-page',
  'admin-z-card',
  'admin-z-table-shell',
];
const failed = required.filter(token => !source.includes(token) && !styles.includes(token));
if (failed.length) {
  console.error(`FAIL missing: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('admin primitives checks passed');
```

- [ ] **Step 2: Run the check to verify it fails**

Run:

```bash
node /tmp/check-admin-primitives.mjs
```

Expected: FAIL with missing primitive names.

- [ ] **Step 3: Create `AdminPage.tsx`**

Implement focused presentational components. Use this exact public API:

```tsx
import type { ReactNode } from 'react';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export function AdminPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`admin-z-page animate-fade-in ${className}`.trim()}>{children}</div>;
}

export function AdminPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-z-page-header">
      <div>
        <h1 className="admin-z-page-title">{title}</h1>
        {subtitle && <p className="admin-z-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="admin-z-page-actions">{actions}</div>}
    </div>
  );
}

export function AdminToolbar({ children }: { children: ReactNode }) {
  return <div className="admin-z-toolbar">{children}</div>;
}

export function AdminStatCard({
  label,
  value,
  icon,
  tone = 'brand',
  meta,
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  tone?: Tone;
  meta?: ReactNode;
}) {
  return (
    <section className={`admin-z-card admin-z-stat admin-z-tone-${tone}`}>
      <div className="admin-z-stat-head">
        <span className="admin-z-stat-label">{label}</span>
        {icon && <span className="material-symbols-outlined admin-z-icon-badge">{icon}</span>}
      </div>
      <div className="admin-z-stat-value">{value}</div>
      {meta && <div className="admin-z-stat-meta">{meta}</div>}
    </section>
  );
}

export function AdminChartCard({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-z-card admin-z-chart ${className}`.trim()}>
      <div className="admin-z-card-header">
        <div className="admin-z-card-title-row">
          {icon && <span className="material-symbols-outlined admin-z-icon-badge">{icon}</span>}
          <div>
            <h2 className="admin-z-card-title">{title}</h2>
            {subtitle && <p className="admin-z-card-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function AdminTableShell({ children }: { children: ReactNode }) {
  return <div className="admin-z-table-shell">{children}</div>;
}

export function AdminEmptyState({ icon = 'inbox', title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <div className="admin-z-empty">
      <span className="material-symbols-outlined">{icon}</span>
      <p>{title}</p>
      {text && <small>{text}</small>}
    </div>
  );
}

export function AdminLoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="admin-z-loading" aria-live="polite">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function AdminStatusBadge({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`admin-z-badge admin-z-tone-${tone}`}>{children}</span>;
}
```

- [ ] **Step 4: Add admin shared CSS**

Append to `apps/admin/src/index.css` a section headed `/* React Zwane parity primitives */`. Include these class groups:

```css
.admin-z-page { width: min(100%, 1600px); margin: 0 auto; display: grid; gap: 28px; }
.admin-z-page-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.admin-z-page-title { margin: 0; font-size: 32px; line-height: 1.08; font-weight: 800; color: var(--color-text); }
.admin-z-page-subtitle { margin: 8px 0 0; color: var(--color-text-muted); font-size: 14px; }
.admin-z-page-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.admin-z-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px; background: rgba(255,255,255,0.78); border: 1px solid rgba(226,232,240,0.7); border-radius: 16px; box-shadow: 0 10px 28px rgba(15,23,42,0.05); backdrop-filter: blur(18px); }
.admin-z-card { position: relative; overflow: hidden; background: rgba(255,255,255,0.92); border: 1px solid rgba(255,255,255,0.62); border-radius: 16px; box-shadow: 0 1px 2px rgba(15,23,42,0.04), 0 10px 28px rgba(15,23,42,0.08); transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s cubic-bezier(.22,1,.36,1); }
.admin-z-card::before { content: ""; position: absolute; top: -70px; right: -70px; width: 170px; height: 170px; border-radius: 999px; background: radial-gradient(circle, rgb(var(--color-primary-rgb) / .12), transparent 70%); pointer-events: none; transition: transform .35s cubic-bezier(.22,1,.36,1), opacity .35s ease; }
.admin-z-card:hover { transform: translateY(-3px); box-shadow: 0 2px 4px rgba(15,23,42,0.05), 0 18px 42px rgba(15,23,42,0.12), 0 0 0 1px rgb(var(--color-primary-rgb) / .10); }
.admin-z-card:hover::before { transform: scale(1.35); opacity: 1; }
.admin-z-card > * { position: relative; z-index: 1; }
.admin-z-stat { padding: 22px; min-height: 150px; }
.admin-z-stat-head, .admin-z-card-header, .admin-z-card-title-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.admin-z-card-title-row { justify-content: flex-start; }
.admin-z-stat-label { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--color-text-muted); }
.admin-z-stat-value { margin-top: 16px; font-size: 30px; line-height: 1.05; font-weight: 800; color: var(--color-text); }
.admin-z-stat-meta, .admin-z-card-subtitle { color: var(--color-text-muted); font-size: 12px; margin-top: 6px; }
.admin-z-icon-badge { width: 40px; height: 40px; border-radius: 12px; display: inline-grid; place-items: center; background: rgb(var(--color-primary-rgb) / .10); color: var(--color-primary); font-size: 21px; }
.admin-z-chart { padding: 22px; }
.admin-z-card-title { margin: 0; font-size: 16px; font-weight: 800; color: var(--color-text); }
.admin-z-table-shell { overflow: auto; border-radius: 16px; background: rgba(255,255,255,.92); box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 10px 28px rgba(15,23,42,.08); border: 1px solid rgba(226,232,240,.72); }
.admin-z-empty, .admin-z-loading { display: grid; place-items: center; gap: 8px; min-height: 180px; color: var(--color-text-muted); text-align: center; }
.admin-z-empty .material-symbols-outlined { font-size: 34px; color: var(--color-primary); }
.admin-z-empty p { margin: 0; font-weight: 800; color: var(--color-text); }
.admin-z-empty small { color: var(--color-text-muted); }
.admin-z-badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 6px 10px; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; background: var(--color-surface-muted); color: var(--color-text-muted); }
.admin-z-tone-brand { color: var(--color-primary); }
.admin-z-tone-success { color: #059669; }
.admin-z-tone-warning { color: #d97706; }
.admin-z-tone-danger { color: #dc2626; }
.admin-z-tone-info { color: #0284c7; }
@media (max-width: 767px) {
  .admin-z-page { gap: 20px; }
  .admin-z-page-title { font-size: 25px; }
  .admin-z-toolbar { align-items: stretch; }
  .admin-z-toolbar > * { min-width: 100%; }
}
```

- [ ] **Step 5: Verify primitive check passes**

Run:

```bash
node /tmp/check-admin-primitives.mjs
```

Expected: `admin primitives checks passed`.

- [ ] **Step 6: Build admin**

Run:

```bash
npm run build --prefix apps/admin
```

Expected: build passes.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/admin/src/components/ui/AdminPage.tsx apps/admin/src/index.css
git commit -m "feat: add admin Zwane-style UI primitives"
```

---

### Task 4: Admin Shell Visual Parity

**Files:**
- Modify: `apps/admin/src/layout/AdminLayout.tsx`
- Modify: `apps/admin/src/index.css`

- [ ] **Step 1: Write a failing shell style check**

Create `/tmp/check-admin-shell-style.mjs`:

```js
import fs from 'node:fs';
const layout = fs.readFileSync('/Users/kurtvonschaeffer/Algolend/apps/admin/src/layout/AdminLayout.tsx', 'utf8');
const css = fs.readFileSync('/Users/kurtvonschaeffer/Algolend/apps/admin/src/index.css', 'utf8');
const checks = [
  ['settings submenu handled', layout.includes("sub.id === 'settings'") || layout.includes('getExpandedNavIds')],
  ['frosted header', css.includes('backdrop-filter: blur(24px)') || css.includes('backdrop-filter: blur(18px)')],
  ['sidebar white/frosted surface', css.includes('.admin-sidebar') && css.includes('box-shadow')],
  ['active nav uses primary', css.includes('.nav-link-active') && css.includes('var(--color-primary)')],
  ['mobile overlay blur', css.includes('.admin-sidebar-overlay') && css.includes('backdrop-filter')],
];
const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error(failed.map(([name]) => `FAIL ${name}`).join('\n'));
  process.exit(1);
}
console.log('admin shell style checks passed');
```

- [ ] **Step 2: Run the check to verify it fails on at least one style criterion**

Run:

```bash
node /tmp/check-admin-shell-style.mjs
```

Expected: FAIL until shell CSS is updated.

- [ ] **Step 3: Restyle the admin shell**

In `apps/admin/src/index.css`, adjust these existing selectors to match Zwane:

- `.admin-sidebar`: white/frosted surface, subtle right shadow, `border-right: 1px solid rgba(0,0,0,0.06)`.
- `.admin-header`: `background: rgba(255,255,255,0.88)`, `backdrop-filter: blur(24px) saturate(2)`, subtle bottom border and shadow.
- `.nav-link`: 12px radius, 13-14px type, smooth 200ms transition.
- `.nav-link-active`: AlgoLend primary gradient/tint or solid primary treatment, white or primary text with strong contrast.
- `.nav-submenu`: keep current max-height/opacity animation and include Settings height.
- `.admin-page`: `padding: 32px`, responsive `20px` mobile padding, no business logic changes.

Keep class names used by existing pages: `.admin-table`, `.chart-card`, `.page-header`, `.btn`, `.admin-input`, `.admin-select`, `.badge`.

- [ ] **Step 4: Verify shell check passes**

Run:

```bash
node /tmp/check-admin-shell-style.mjs
```

Expected: `admin shell style checks passed`.

- [ ] **Step 5: Build admin**

Run:

```bash
npm run build --prefix apps/admin
```

Expected: build passes.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/admin/src/layout/AdminLayout.tsx apps/admin/src/index.css
git commit -m "feat: match admin shell to Zwane layout"
```

---

### Task 5: Admin Dashboard And Analytics Pages

**Files:**
- Modify: `apps/admin/src/pages/DashboardPage.tsx`
- Modify: `apps/admin/src/pages/AnalyticsPage.tsx`
- Modify: `apps/admin/src/pages/FinancialsPage.tsx`
- Modify: `apps/admin/src/pages/PortfolioPage.tsx`
- Modify: `apps/admin/src/index.css`

- [ ] **Step 1: Write a failing dashboard static check**

Create `/tmp/check-admin-dashboard-ui.mjs`:

```js
import fs from 'node:fs';
const files = [
  'apps/admin/src/pages/DashboardPage.tsx',
  'apps/admin/src/pages/AnalyticsPage.tsx',
  'apps/admin/src/pages/FinancialsPage.tsx',
  'apps/admin/src/pages/PortfolioPage.tsx',
].map(p => fs.readFileSync(`/Users/kurtvonschaeffer/Algolend/${p}`, 'utf8')).join('\n');
const checks = [
  ['uses AdminPageShell', files.includes('AdminPageShell')],
  ['uses AdminPageHeader', files.includes('AdminPageHeader')],
  ['uses AdminStatCard', files.includes('AdminStatCard')],
  ['uses AdminChartCard', files.includes('AdminChartCard')],
  ['keeps ApexCharts dashboard motion', files.includes('animations: ANIM') || files.includes('APEX_ANIM')],
];
const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error(failed.map(([name]) => `FAIL ${name}`).join('\n'));
  process.exit(1);
}
console.log('admin dashboard UI checks passed');
```

- [ ] **Step 2: Run the check to verify it fails**

Run:

```bash
node /tmp/check-admin-dashboard-ui.mjs
```

Expected: FAIL because pages are not yet using shared primitives.

- [ ] **Step 3: Migrate dashboard wrappers**

In each target page:

- Import `AdminPageShell`, `AdminPageHeader`, `AdminStatCard`, and `AdminChartCard` from `../components/ui/AdminPage`.
- Keep all existing `useQuery`, `useEffect`, formatting, chart refs, and chart render logic.
- Replace top-level fragments with `<AdminPageShell>`.
- Replace header blocks with `<AdminPageHeader title="..." subtitle="..." actions={...} />`.
- Replace KPI card markup with `<AdminStatCard>`.
- Replace chart card containers with `<AdminChartCard>`.

Do not change data service imports from `../services/adminData`.

- [ ] **Step 4: Preserve chart animation config**

Confirm `DashboardPage.tsx` still contains:

```ts
const ANIM = { enabled: true, easing: 'easeinout' as const, speed: 900, animateGradually: { enabled: true, delay: 120 } };
```

If another page has its own Apex config, keep animation properties rather than replacing chart logic.

- [ ] **Step 5: Verify dashboard static check passes**

Run:

```bash
node /tmp/check-admin-dashboard-ui.mjs
```

Expected: `admin dashboard UI checks passed`.

- [ ] **Step 6: Build admin**

Run:

```bash
npm run build --prefix apps/admin
```

Expected: build passes.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/admin/src/pages/DashboardPage.tsx apps/admin/src/pages/AnalyticsPage.tsx apps/admin/src/pages/FinancialsPage.tsx apps/admin/src/pages/PortfolioPage.tsx apps/admin/src/index.css
git commit -m "feat: restyle admin dashboard and analytics pages"
```

---

### Task 6: Admin Tables, Finance, Tools, And Compliance Pages

**Files:**
- Modify: `apps/admin/src/pages/ApplicationsPage.tsx`
- Modify: `apps/admin/src/pages/ApplicationDetailPage.tsx`
- Modify: `apps/admin/src/pages/CreateApplicationPage.tsx`
- Modify: `apps/admin/src/pages/MandatesPage.tsx`
- Modify: `apps/admin/src/pages/IncomingPaymentsPage.tsx`
- Modify: `apps/admin/src/pages/OutgoingPaymentsPage.tsx`
- Modify: `apps/admin/src/pages/CreditRulesPage.tsx`
- Modify: `apps/admin/src/pages/LoanBookPage.tsx`
- Modify: `apps/admin/src/pages/CashLedgerPage.tsx`
- Modify: `apps/admin/src/pages/CompliancePage.tsx`
- Modify: `apps/admin/src/pages/SettingsPage.tsx`
- Modify: `apps/admin/src/pages/UsersPage.tsx`
- Modify: `apps/admin/src/index.css`

- [ ] **Step 1: Write a failing page coverage check**

Create `/tmp/check-admin-all-pages-ui.mjs`:

```js
import fs from 'node:fs';
const root = '/Users/kurtvonschaeffer/Algolend/apps/admin/src/pages';
const pages = [
  'ApplicationsPage.tsx',
  'ApplicationDetailPage.tsx',
  'CreateApplicationPage.tsx',
  'MandatesPage.tsx',
  'IncomingPaymentsPage.tsx',
  'OutgoingPaymentsPage.tsx',
  'CreditRulesPage.tsx',
  'LoanBookPage.tsx',
  'CashLedgerPage.tsx',
  'CompliancePage.tsx',
  'SettingsPage.tsx',
  'UsersPage.tsx',
];
const failed = [];
for (const page of pages) {
  const src = fs.readFileSync(`${root}/${page}`, 'utf8');
  if (!src.includes('AdminPageShell') && !src.includes('AdminTableShell') && !src.includes('AdminChartCard')) {
    failed.push(`${page} missing shared admin primitive`);
  }
}
if (failed.length) {
  console.error(failed.map(f => `FAIL ${f}`).join('\n'));
  process.exit(1);
}
console.log('admin all-pages UI checks passed');
```

- [ ] **Step 2: Run the check to verify it fails**

Run:

```bash
node /tmp/check-admin-all-pages-ui.mjs
```

Expected: FAIL for pages not yet migrated.

- [ ] **Step 3: Migrate table/list pages**

For `ApplicationsPage.tsx`, `MandatesPage.tsx`, `IncomingPaymentsPage.tsx`, `OutgoingPaymentsPage.tsx`, `LoanBookPage.tsx`, and `CashLedgerPage.tsx`:

- Import `AdminPageShell`, `AdminPageHeader`, `AdminToolbar`, `AdminTableShell`, `AdminEmptyState`, `AdminLoadingBlock`, and `AdminStatusBadge`.
- Keep query keys, mutation functions, local state, filters, sort/search behavior, and event handlers unchanged.
- Wrap top-level content in `AdminPageShell`.
- Wrap filter/search controls in `AdminToolbar`.
- Wrap `<table className="admin-table">` with `<AdminTableShell>`.
- Replace empty-state blocks with `AdminEmptyState`.
- Replace loading blocks with `AdminLoadingBlock`.

- [ ] **Step 4: Migrate detail/form/tool pages**

For `ApplicationDetailPage.tsx`, `CreateApplicationPage.tsx`, `CreditRulesPage.tsx`, `CompliancePage.tsx`, `SettingsPage.tsx`, and `UsersPage.tsx`:

- Import relevant admin primitives.
- Preserve all action handlers and service calls.
- Use `AdminPageHeader` for page titles.
- Use `AdminChartCard` or existing `chart-card` with updated CSS for grouped sections.
- Use `AdminStatusBadge` where statuses are currently custom spans and no behavior depends on the old badge class.
- Keep the embedded `UsersPage` rendering from Task 2.

- [ ] **Step 5: Add responsive table CSS**

In `apps/admin/src/index.css`, add table parity rules:

```css
.admin-table { width: 100%; border-collapse: separate; border-spacing: 0; }
.admin-table thead th { position: sticky; top: 0; z-index: 2; background: rgba(248,250,252,.96); backdrop-filter: blur(12px); color: var(--color-text-muted); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.admin-table tbody tr { transition: background-color .18s ease, transform .18s ease; }
.admin-table tbody tr:hover { background: rgb(var(--color-primary-rgb) / .045); }
.admin-table td, .admin-table th { border-bottom: 1px solid rgba(226,232,240,.72); }
@media (max-width: 767px) {
  .admin-table-wrap, .admin-z-table-shell { border-radius: 14px; }
  .admin-table { min-width: 760px; }
}
```

- [ ] **Step 6: Verify all-pages check passes**

Run:

```bash
node /tmp/check-admin-all-pages-ui.mjs
```

Expected: `admin all-pages UI checks passed`.

- [ ] **Step 7: Build admin**

Run:

```bash
npm run build --prefix apps/admin
```

Expected: build passes.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/admin/src/pages/ApplicationsPage.tsx apps/admin/src/pages/ApplicationDetailPage.tsx apps/admin/src/pages/CreateApplicationPage.tsx apps/admin/src/pages/MandatesPage.tsx apps/admin/src/pages/IncomingPaymentsPage.tsx apps/admin/src/pages/OutgoingPaymentsPage.tsx apps/admin/src/pages/CreditRulesPage.tsx apps/admin/src/pages/LoanBookPage.tsx apps/admin/src/pages/CashLedgerPage.tsx apps/admin/src/pages/CompliancePage.tsx apps/admin/src/pages/SettingsPage.tsx apps/admin/src/pages/UsersPage.tsx apps/admin/src/index.css
git commit -m "feat: restyle all admin React pages"
```

---

### Task 7: Portal Shared Zwane-Style Primitives

**Files:**
- Create: `apps/portal/src/components/ui/PortalPage.tsx`
- Modify: `apps/portal/src/index.css`

- [ ] **Step 1: Write a failing portal primitive check**

Create `/tmp/check-portal-primitives.mjs`:

```js
import fs from 'node:fs';
const file = '/Users/kurtvonschaeffer/Algolend/apps/portal/src/components/ui/PortalPage.tsx';
const css = '/Users/kurtvonschaeffer/Algolend/apps/portal/src/index.css';
const source = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const styles = fs.readFileSync(css, 'utf8');
const required = [
  'PortalPageShell',
  'PortalSectionHeader',
  'PortalBentoGrid',
  'PortalCard',
  'PortalActionCard',
  'PortalEmptyState',
  'PortalLoadingBlock',
  'portal-z-page',
  'portal-z-card',
  'portal-z-bento',
];
const failed = required.filter(token => !source.includes(token) && !styles.includes(token));
if (failed.length) {
  console.error(`FAIL missing: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('portal primitives checks passed');
```

- [ ] **Step 2: Run the check to verify it fails**

Run:

```bash
node /tmp/check-portal-primitives.mjs
```

Expected: FAIL with missing primitive names.

- [ ] **Step 3: Create `PortalPage.tsx`**

Create this public API:

```tsx
import type { ReactNode } from 'react';
import { Loader } from './loader';

export function PortalPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`portal-z-page ${className}`.trim()}>{children}</div>;
}

export function PortalSectionHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="portal-z-section-header">
      <div>
        {eyebrow && <p className="portal-z-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="portal-z-actions">{actions}</div>}
    </header>
  );
}

export function PortalBentoGrid({ children }: { children: ReactNode }) {
  return <div className="portal-z-bento">{children}</div>;
}

export function PortalCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`portal-z-card ${className}`.trim()}>{children}</section>;
}

export function PortalActionCard({ icon, title, text, onClick }: { icon: string; title: string; text?: string; onClick?: () => void }) {
  return (
    <button type="button" className="portal-z-action-card" onClick={onClick}>
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
      <span>{title}</span>
      {text && <small>{text}</small>}
    </button>
  );
}

export function PortalEmptyState({ icon = 'fa-inbox', title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <div className="portal-z-empty">
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
      <p>{title}</p>
      {text && <small>{text}</small>}
    </div>
  );
}

export function PortalLoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="portal-z-loading" aria-live="polite">
      <Loader label={label} />
    </div>
  );
}
```

- [ ] **Step 4: Add portal shared CSS**

Append to `apps/portal/src/index.css`:

```css
/* React Zwane parity portal primitives */
.portal-z-page { width: min(100%, 1280px); margin: 0 auto; display: grid; gap: 24px; padding: 0 16px; }
.portal-z-section-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
.portal-z-section-header h1 { margin: 0; font-size: 34px; line-height: 1.05; font-weight: 800; color: #0f172a; letter-spacing: 0; }
.portal-z-section-header p { margin: 7px 0 0; color: #64748b; }
.portal-z-eyebrow { margin: 0 0 6px !important; font-size: 12px !important; font-weight: 800 !important; letter-spacing: .08em !important; text-transform: uppercase !important; color: var(--color-primary) !important; }
.portal-z-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.portal-z-bento { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; }
.portal-z-card { position: relative; overflow: hidden; background: rgba(255,255,255,.94); border: 1px solid rgba(255,255,255,.65); border-radius: 18px; box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 10px 30px rgba(15,23,42,.08); transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s cubic-bezier(.22,1,.36,1); }
.portal-z-card::before { content: ""; position: absolute; top: -64px; right: -64px; width: 150px; height: 150px; border-radius: 999px; background: radial-gradient(circle, rgb(var(--color-primary-rgb) / .11), transparent 70%); pointer-events: none; }
.portal-z-card:hover { transform: translateY(-3px); box-shadow: 0 2px 4px rgba(15,23,42,.05), 0 18px 42px rgba(15,23,42,.12); }
.portal-z-card > * { position: relative; z-index: 1; }
.portal-z-action-card { width: 100%; min-height: 120px; border: 0; border-radius: 18px; background: rgba(255,255,255,.94); box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 10px 30px rgba(15,23,42,.08); display: grid; gap: 8px; align-content: center; justify-items: start; padding: 20px; color: #0f172a; cursor: pointer; transition: transform .25s cubic-bezier(.22,1,.36,1), box-shadow .25s cubic-bezier(.22,1,.36,1); }
.portal-z-action-card:hover { transform: translateY(-3px); box-shadow: 0 2px 4px rgba(15,23,42,.05), 0 18px 42px rgba(15,23,42,.12); }
.portal-z-action-card i { color: var(--color-primary); font-size: 22px; }
.portal-z-action-card span { font-weight: 800; }
.portal-z-action-card small { color: #64748b; text-align: left; }
.portal-z-empty, .portal-z-loading { min-height: 180px; display: grid; place-items: center; gap: 8px; color: #64748b; text-align: center; }
.portal-z-empty i { color: var(--color-primary); font-size: 30px; }
.portal-z-empty p { margin: 0; font-weight: 800; color: #0f172a; }
@media (max-width: 767px) {
  .portal-z-page { gap: 18px; padding: 0 10px 90px; }
  .portal-z-section-header h1 { font-size: 28px; }
  .portal-z-bento { grid-template-columns: 1fr; }
}
```

- [ ] **Step 5: Verify primitive check passes**

Run:

```bash
node /tmp/check-portal-primitives.mjs
```

Expected: `portal primitives checks passed`.

- [ ] **Step 6: Run portal tests and build**

Run:

```bash
npm test --prefix apps/portal
npm run build --prefix apps/portal
```

Expected: tests and build pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/portal/src/components/ui/PortalPage.tsx apps/portal/src/index.css
git commit -m "feat: add portal Zwane-style UI primitives"
```

---

### Task 8: Portal Shell, Dashboard, And Auth Visual Parity

**Files:**
- Modify: `apps/portal/src/layout/PortalLayout.tsx`
- Modify: `apps/portal/src/pages/DashboardPage.tsx`
- Modify: `apps/portal/src/auth/AuthPage.tsx`
- Modify: `apps/portal/src/auth/SetPasswordPage.tsx`
- Modify: `apps/portal/src/index.css`
- Modify: `apps/portal/src/legacy-css/04-navbar.css`
- Modify: `apps/portal/src/legacy-css/05-sidebar.css`
- Modify: `apps/portal/src/legacy-css/10-dashboard.css`

- [ ] **Step 1: Write a failing portal shell/dashboard check**

Create `/tmp/check-portal-shell-dashboard.mjs`:

```js
import fs from 'node:fs';
const root = '/Users/kurtvonschaeffer/Algolend';
const layout = fs.readFileSync(`${root}/apps/portal/src/layout/PortalLayout.tsx`, 'utf8');
const dash = fs.readFileSync(`${root}/apps/portal/src/pages/DashboardPage.tsx`, 'utf8');
const auth = fs.readFileSync(`${root}/apps/portal/src/auth/AuthPage.tsx`, 'utf8');
const css = [
  `${root}/apps/portal/src/index.css`,
  `${root}/apps/portal/src/legacy-css/04-navbar.css`,
  `${root}/apps/portal/src/legacy-css/05-sidebar.css`,
  `${root}/apps/portal/src/legacy-css/10-dashboard.css`,
].map(f => fs.readFileSync(f, 'utf8')).join('\n');
const checks = [
  ['layout keeps Luma dock', layout.includes('luma-nav-container')],
  ['layout keeps guarded apply navigation', layout.includes('guardedNavigate')],
  ['dashboard uses portal primitives', dash.includes('PortalPageShell') || dash.includes('portal-z-page')],
  ['dashboard keeps credit score canvas/effect', dash.includes('CREDIT_SCORE_MAX') && dash.includes('creditScore')],
  ['auth keeps role redirect', auth.includes('hasMinimumRole') && auth.includes('/admin-panel/dashboard')],
  ['frosted navbar CSS', css.includes('backdrop-filter') && css.includes('navbar-desktop')],
];
const failed = checks.filter(([, pass]) => !pass);
if (failed.length) {
  console.error(failed.map(([name]) => `FAIL ${name}`).join('\n'));
  process.exit(1);
}
console.log('portal shell/dashboard checks passed');
```

- [ ] **Step 2: Run the check to verify it fails**

Run:

```bash
node /tmp/check-portal-shell-dashboard.mjs
```

Expected: FAIL until dashboard/auth/shell parity work is done.

- [ ] **Step 3: Restyle `PortalLayout.tsx` without changing navigation behavior**

Keep these functions and state variables intact:

- `showProfileIncompleteToast`
- `guardedNavigate`
- `lumaNavigate`
- `accountDropdown`
- `moreMenuOpen`
- `LUMA_ITEMS`
- `NAV_ITEMS`

Update markup classes only where needed to match Zwane reference. Do not remove `luma-nav-container`, `luma-dock`, or `luma-item`.

- [ ] **Step 4: Restyle portal dashboard**

In `DashboardPage.tsx`:

- Import `PortalPageShell`, `PortalSectionHeader`, `PortalBentoGrid`, `PortalCard`, `PortalActionCard`, `PortalEmptyState`, and `PortalLoadingBlock`.
- Keep `fetchDashboard`, `LineChart`, `CreditScoreMeter`, navigation handlers, eligibility logic, and all existing calculations.
- Wrap dashboard content in `PortalPageShell`.
- Use `PortalBentoGrid` for main dashboard card layout.
- Use `PortalCard` around loan summary, repayment chart, credit score, applications, and transactions.
- Keep current animation classes and dashboard CSS selectors used by existing effects.

- [ ] **Step 5: Restyle auth pages**

For `AuthPage.tsx` and `SetPasswordPage.tsx`:

- Preserve Supabase calls.
- Preserve `redirectToForRole`.
- Preserve set-password redirect behavior.
- Re-skin panels, forms, and buttons to Zwane auth visual language using AlgoLend theme variables and configured imagery.

- [ ] **Step 6: Verify shell/dashboard check passes**

Run:

```bash
node /tmp/check-portal-shell-dashboard.mjs
```

Expected: `portal shell/dashboard checks passed`.

- [ ] **Step 7: Run portal tests and build**

Run:

```bash
npm test --prefix apps/portal
npm run build --prefix apps/portal
```

Expected: tests and build pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/portal/src/layout/PortalLayout.tsx apps/portal/src/pages/DashboardPage.tsx apps/portal/src/auth/AuthPage.tsx apps/portal/src/auth/SetPasswordPage.tsx apps/portal/src/index.css apps/portal/src/legacy-css/04-navbar.css apps/portal/src/legacy-css/05-sidebar.css apps/portal/src/legacy-css/10-dashboard.css
git commit -m "feat: match portal shell dashboard and auth to Zwane"
```

---

### Task 9: Portal Remaining Pages Visual Parity

**Files:**
- Modify: `apps/portal/src/pages/ApplyLoanPage.tsx`
- Modify: `apps/portal/src/pages/LoanCalculatorPage.tsx`
- Modify: `apps/portal/src/pages/TranscriptsPage.tsx`
- Modify: `apps/portal/src/pages/TransactionsPage.tsx`
- Modify: `apps/portal/src/pages/SupportPage.tsx`
- Modify: `apps/portal/src/pages/ProfilePage.tsx`
- Modify: `apps/portal/src/legacy-css/11-loan-calculator.css`
- Modify: `apps/portal/src/legacy-css/12-support.css`
- Modify: `apps/portal/src/legacy-css/13-transcripts.css`
- Modify: `apps/portal/src/legacy-css/14b-payments.css`
- Modify: `apps/portal/src/legacy-css/15-profile.css`
- Modify: `apps/portal/src/legacy-css/16-apply-loan.css`
- Modify: `apps/portal/src/legacy-css/20-apply-loan-inline.css`

- [ ] **Step 1: Write a failing remaining-pages check**

Create `/tmp/check-portal-all-pages-ui.mjs`:

```js
import fs from 'node:fs';
const root = '/Users/kurtvonschaeffer/Algolend/apps/portal/src/pages';
const pages = [
  'ApplyLoanPage.tsx',
  'LoanCalculatorPage.tsx',
  'TranscriptsPage.tsx',
  'TransactionsPage.tsx',
  'SupportPage.tsx',
  'ProfilePage.tsx',
];
const failed = [];
for (const page of pages) {
  const src = fs.readFileSync(`${root}/${page}`, 'utf8');
  if (!src.includes('PortalPageShell') && !src.includes('PortalCard') && !src.includes('portal-z-')) {
    failed.push(`${page} missing shared portal primitive`);
  }
}
const apply = fs.readFileSync(`${root}/ApplyLoanPage.tsx`, 'utf8');
const profile = fs.readFileSync(`${root}/ProfilePage.tsx`, 'utf8');
if (!apply.includes('LoanApplyExplainer')) failed.push('ApplyLoanPage missing LoanApplyExplainer preservation');
if (!profile.includes('profileCompletion') && !profile.includes('missingItems')) failed.push('ProfilePage missing profile completion preservation');
if (failed.length) {
  console.error(failed.map(f => `FAIL ${f}`).join('\n'));
  process.exit(1);
}
console.log('portal all-pages UI checks passed');
```

- [ ] **Step 2: Run the check to verify it fails**

Run:

```bash
node /tmp/check-portal-all-pages-ui.mjs
```

Expected: FAIL for pages not yet migrated.

- [ ] **Step 3: Migrate Apply without removing effects**

In `ApplyLoanPage.tsx`:

- Import portal primitives.
- Keep all profile guard, query invalidation, Supabase calls, API calls, calculations, toasts, and `LoanApplyExplainer`.
- Wrap content in `PortalPageShell`.
- Use `PortalCard` for form sections and loan/result summaries.
- Preserve CSS classes used by the coach/highlight effect.

- [ ] **Step 4: Migrate Calculator, Transcripts, Transactions, Support, and Profile**

For each target page:

- Import portal primitives.
- Keep all existing hooks, queries, handlers, validation, navigation, and calculations.
- Wrap content in `PortalPageShell`.
- Use `PortalSectionHeader` for page headers.
- Use `PortalCard` or `PortalActionCard` for grouped surfaces.
- Keep page-specific CSS imports through `usePageCSS`.
- Preserve existing animation class names in legacy CSS.

- [ ] **Step 5: Tune page-specific CSS**

In the listed legacy CSS files:

- Apply AlgoLend primary/secondary variables to buttons, active states, icon badges, progress bars, card glows, and focus states.
- Match Zwane reference spacing, white card surfaces, bento card rhythm, hover lift, and responsive behavior.
- Keep `@media (prefers-reduced-motion: reduce)` sections where present.

- [ ] **Step 6: Verify remaining-pages check passes**

Run:

```bash
node /tmp/check-portal-all-pages-ui.mjs
```

Expected: `portal all-pages UI checks passed`.

- [ ] **Step 7: Run portal tests and build**

Run:

```bash
npm test --prefix apps/portal
npm run build --prefix apps/portal
```

Expected: tests and build pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/portal/src/pages/ApplyLoanPage.tsx apps/portal/src/pages/LoanCalculatorPage.tsx apps/portal/src/pages/TranscriptsPage.tsx apps/portal/src/pages/TransactionsPage.tsx apps/portal/src/pages/SupportPage.tsx apps/portal/src/pages/ProfilePage.tsx apps/portal/src/legacy-css/11-loan-calculator.css apps/portal/src/legacy-css/12-support.css apps/portal/src/legacy-css/13-transcripts.css apps/portal/src/legacy-css/14b-payments.css apps/portal/src/legacy-css/15-profile.css apps/portal/src/legacy-css/16-apply-loan.css apps/portal/src/legacy-css/20-apply-loan-inline.css
git commit -m "feat: restyle all borrower portal pages"
```

---

### Task 10: Branding, Visual Verification, And Final Builds

**Files:**
- Modify only if verification finds React UI issues:
  - `apps/admin/src/**/*`
  - `apps/portal/src/**/*`

- [ ] **Step 1: Write branding check**

Create `/tmp/check-no-zwane-branding.mjs`:

```js
import { execSync } from 'node:child_process';
const root = '/Users/kurtvonschaeffer/Algolend';
const output = execSync("rg -n \"Zwane|ZwaneOfficial|zwane\" apps/admin/src apps/portal/src --glob '!*.test.*'", {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
const allowed = output
  .split('\n')
  .filter(Boolean)
  .filter(line => line.includes('Zwane parity') || line.includes('Zwane-style'));
if (allowed.length !== output.split('\n').filter(Boolean).length) {
  console.error(output);
  process.exit(1);
}
console.log('no disallowed Zwane branding found');
```

- [ ] **Step 2: Run branding check**

Run:

```bash
node /tmp/check-no-zwane-branding.mjs
```

Expected: `no disallowed Zwane branding found`. If `rg` exits with no matches, update the script to treat no matches as success by wrapping `execSync` in `try/catch`.

- [ ] **Step 3: Run final builds/tests**

Run:

```bash
npm run build --prefix apps/admin
npm test --prefix apps/portal
npm run build --prefix apps/portal
```

Expected: all pass.

- [ ] **Step 4: Start local server for visual checks**

Run:

```bash
npm run dev
```

Expected: Express server starts on `http://localhost:5000` or the configured `PORT`.

- [ ] **Step 5: Browser-check admin desktop**

Open:

```text
http://localhost:5000/admin-panel/dashboard
http://localhost:5000/admin-panel/applications
http://localhost:5000/admin-panel/settings
http://localhost:5000/admin-panel/settings/user-management
http://localhost:5000/admin-panel/loan-book
http://localhost:5000/admin-panel/compliance-tracker
```

Expected:

- Sidebar/header visually match ZwaneOfficial.
- No top-level Users nav item.
- Settings submenu contains General and User Management.
- User Management table/search/role editing is visible under Settings.
- Cards, tables, filters, badges, charts, empty/loading states match Zwane quality using AlgoLend colors.

- [ ] **Step 6: Browser-check portal desktop and mobile**

Open:

```text
http://localhost:5000/user-portal/dashboard
http://localhost:5000/user-portal/apply
http://localhost:5000/user-portal/calculator
http://localhost:5000/user-portal/transcripts
http://localhost:5000/user-portal/transactions
http://localhost:5000/user-portal/support
http://localhost:5000/user-portal/profile
http://localhost:5000/auth/login
http://localhost:5000/auth/set-password
```

Expected:

- Portal top nav, sidebar, and mobile dock visually match ZwaneOfficial.
- Apply guard and coach/highlight behavior remain.
- Dashboard credit score/loan cards retain motion.
- Profile completion and form behavior remain.
- Login and set-password redirects remain unchanged.
- No text overlaps on mobile widths.

- [ ] **Step 7: Final status check**

Run:

```bash
git status --short
```

Expected: only intended React files changed. Unrelated pre-existing user changes may still appear and must not be staged.

- [ ] **Step 8: Commit final visual fixes**

If verification required fixes, stage only files changed in this task:

```bash
git add apps/admin/src apps/portal/src
git commit -m "fix: polish React Zwane parity verification issues"
```

If no fixes were required, do not create an empty commit.

---

## Self-Review Checklist

- Spec coverage: Tasks cover all React admin pages, all React portal pages, auth screens, navigation relocation, branding, functionality preservation, animation preservation, builds, tests, and browser checks.
- Placeholder scan: No task contains `TBD`, `TODO`, or an unresolved implementation placeholder.
- Type consistency: Shared component names are consistent across tasks: `AdminPageShell`, `AdminPageHeader`, `AdminToolbar`, `AdminStatCard`, `AdminChartCard`, `AdminTableShell`, `AdminEmptyState`, `AdminLoadingBlock`, `AdminStatusBadge`, `PortalPageShell`, `PortalSectionHeader`, `PortalBentoGrid`, `PortalCard`, `PortalActionCard`, `PortalEmptyState`, `PortalLoadingBlock`.
