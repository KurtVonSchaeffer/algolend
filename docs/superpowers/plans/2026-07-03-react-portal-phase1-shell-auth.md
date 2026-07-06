# React User-Portal Rewrite — Phase 1: Shell + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/portal` — a Vite + React + TypeScript app with theming, a typed API client, and a working auth flow (login/signup/forgot/set-password) — proven end-to-end against the live Express + Supabase backend with a placeholder authenticated dashboard route.

**Architecture:** New app lives at `apps/portal/`, outside `public/`, so the legacy vanilla portal at `public/user-portal/` and `public/auth/` keeps running untouched. During development, Vite's dev server proxies `/api/*` to the existing Express server (port 3002); Supabase calls go directly to Supabase, exactly as the legacy app does today. Wiring Express to serve the built app is deferred to the cutover task at the end of the whole migration (not this phase) — this phase only proves the app works standalone via `vite dev` + the real backend.

**Tech Stack:** Vite 5, React 18, TypeScript 5, React Router 6, TanStack Query 5, Supabase JS 2 (same client config as today), Tailwind CSS 3, shadcn/ui-pattern primitives (class-variance-authority + Radix Slot), Vitest + React Testing Library, Playwright (already a repo dev dependency).

---

## Ported contracts (reference — do not deviate)

These are the exact behaviors from the current vanilla app that Phase 1 must reproduce. They were extracted from the current code, not invented:

- **Supabase client config** (`public/Services/supabaseClient.js`): `storage: window.localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: true`.
- **API fetch pattern** (`public/admin/src/shared/apiFetch.js`): attach `Authorization: Bearer <session.access_token>`; on `401`, refresh the session once and retry; if refresh fails or the retry also 401s, redirect to `/auth/login`.
- **Role hierarchy** (`public/auth/auth.js:67-79`): `{ borrower: 0, user: 0, support: 1, admin: 2, base_admin: 2, super_admin: 3, owner: 4 }`. `hasMinimumRole(role, minimumRole)` lowercases both and compares levels (unknown role = level 0).
- **Post-login redirect** (`public/auth/auth.js:85-105,741-746`): read role from `session.user.app_metadata.role` (fallback `user_metadata.role`); if `hasMinimumRole(role, 'base_admin')` redirect to `/admin/dashboard`, else `/user-portal/dashboard` (this phase's placeholder route). If the JWT has no usable role, fall back to `supabase.rpc('is_role_or_higher', { p_min_role: minimumRole })`.
- **Theme contract** (`public/shared/theme-runtime.js`): fetch `GET /api/system-settings` → `{ data: {...} }`; normalize with defaults (`primary_color: '#B026FF'`, `secondary_color: '#4A0E8F'`, `tertiary_color: '#11022A'`, `theme_mode: 'dark'`, `auth_overlay_color: '#1E0B3B'`, `auth_overlay_enabled: true`); set CSS variables `--color-primary`, `--color-primary-rgb`, `--color-primary-hover` (darken 15%), `--color-primary-soft` (lighten 20%), `--color-primary-strong` (darken 35%), `--color-secondary`, `--color-secondary-rgb`, `--color-secondary-soft` (lighten 15%), `--color-tertiary`, `--color-tertiary-rgb`, `--gradient-brand`, `--color-primary-contrast` (luminance-based), `--auth-overlay-color`, `--auth-overlay-enabled`, and `data-theme` attribute on `<html>`. Cache for 5 minutes.
- **Session guard** (`public/user-portal/Services/sessionGuard.js`): no session → redirect to login. Role must be one of `['borrower','super_admin','admin','base_admin','owner']`, else sign out and redirect. (Not re-verifying the `profiles` row in this phase — that check is a defense-in-depth extra the legacy code has; note it as a Phase 2 follow-up once the profile-data hook exists, so we don't build a one-off Supabase call here that Phase 2 will duplicate.)
- **Bug fix included in this phase:** `public/auth/auth.js:784` sends password-reset emails to `/auth/update-password.html`, which does not exist anywhere in the repo (verified: only `login.html` and `set-password.html` exist under `public/auth/`). The React port's forgot-password flow must redirect to `/auth/set-password` instead, which already has the correct `PASSWORD_RECOVERY` event handling built in (`public/auth/set-password.html:104-110`).
- **Set-password flow** (`public/auth/set-password.html:88-162`): listens for Supabase `SIGNED_IN` or `PASSWORD_RECOVERY` auth events (invite links and reset links both land here); on submit, validates length ≥ 8 and match, calls `supabase.auth.updateUser({ password })`, then redirects to `?next=` param if present, else `/user-portal/dashboard` for borrowers or `/admin/dashboard` otherwise.

---

## File structure for this phase

```
apps/portal/
  package.json
  vite.config.ts
  tsconfig.json
  tailwind.config.ts
  postcss.config.js
  index.html
  vitest.config.ts
  src/
    main.tsx
    App.tsx
    index.css
    lib/
      utils.ts              # cn() class-merge helper (shadcn convention)
      navigation.ts          # redirectTo() — isolates window.location.replace for testability
    theme/
      constants.ts           # DEFAULT_SYSTEM_SETTINGS, DEFAULT_CAROUSEL_SLIDES, types
      colorUtils.ts           # pure color math, ported from theme-runtime.js
      colorUtils.test.ts
      ThemeProvider.tsx
    api/
      supabaseClient.ts
      apiClient.ts
      apiClient.test.ts
    auth/
      roles.ts               # ADMIN_ROLE_LEVELS, hasMinimumRole, resolveAdminAccess
      roles.test.ts
      useSession.ts           # session state + ProtectedRoute
      AuthPage.tsx            # login/signup/forgot tri-state form
      SetPasswordPage.tsx
    components/
      ui/
        button.tsx
        input.tsx
        label.tsx
        alert.tsx
    layout/
      PortalLayout.tsx
      PageRedirect.tsx        # ?page=X → /user-portal/:page shim
    pages/
      DashboardPage.tsx        # placeholder — proves the whole chain end-to-end
  tests/
    setup.ts
e2e/
  portal-login.spec.js          # Playwright smoke test (repo-root e2e, alongside existing test-playwright*.js)
```

---

### Task 1: Scaffold the Vite + React + TypeScript app

**Files:**
- Create: `apps/portal/package.json`
- Create: `apps/portal/vite.config.ts`
- Create: `apps/portal/tsconfig.json`
- Create: `apps/portal/tsconfig.node.json`
- Create: `apps/portal/index.html`
- Create: `apps/portal/src/main.tsx`
- Create: `apps/portal/src/App.tsx`
- Create: `apps/portal/src/index.css`
- Create: `apps/portal/tailwind.config.ts`
- Create: `apps/portal/postcss.config.js`
- Create: `apps/portal/.gitignore`

- [ ] **Step 1: Create the package.json**

```json
{
  "name": "@algolend/portal",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.81.1",
    "@radix-ui/react-slot": "^1.1.0",
    "@tanstack/react-query": "^5.56.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "tailwind-merge": "^2.5.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Create the Vite config with the dev API proxy**

```typescript
// apps/portal/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist'
  }
});
```

- [ ] **Step 3: Create tsconfig.json and tsconfig.node.json**

```json
// apps/portal/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```json
// apps/portal/tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create index.html**

```html
<!-- apps/portal/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AlgoLend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create Tailwind config wired to the CSS-variable theme**

```typescript
// apps/portal/tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
          strong: 'var(--color-primary-strong)',
          contrast: 'var(--color-primary-contrast)'
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          soft: 'var(--color-secondary-soft)'
        },
        tertiary: 'var(--color-tertiary)'
      },
      backgroundImage: {
        'gradient-brand': 'var(--gradient-brand)'
      }
    }
  },
  plugins: []
} satisfies Config;
```

```javascript
// apps/portal/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};
```

- [ ] **Step 6: Create src/index.css**

```css
/* apps/portal/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #7C3AED;
  --color-primary-rgb: 124 58 237;
  --color-primary-hover: #6D28D9;
  --color-primary-soft: #A78BFA;
  --color-primary-strong: #5B21B6;
  --color-secondary: #4A0E8F;
  --color-secondary-rgb: 74 14 143;
  --color-secondary-soft: #6D28D9;
  --color-tertiary: #11022A;
  --color-tertiary-rgb: 17 2 42;
  --gradient-brand: linear-gradient(120deg, var(--color-primary), var(--color-secondary), var(--color-tertiary));
  --color-primary-contrast: #FFFFFF;
  --auth-overlay-color: #1E0B3B;
  --auth-overlay-enabled: 1;
}

body {
  font-family: 'Inter', system-ui, sans-serif;
}
```

- [ ] **Step 7: Create a placeholder App.tsx and main.tsx**

```tsx
// apps/portal/src/App.tsx
export default function App() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <h1 className="text-2xl font-black text-gray-900">AlgoLend Portal</h1>
    </div>
  );
}
```

```tsx
// apps/portal/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 8: Create .gitignore for the app**

```
# apps/portal/.gitignore
node_modules
dist
*.local
```

- [ ] **Step 9: Install dependencies and verify the dev server boots**

Run:
```bash
cd apps/portal && npm install
```
Expected: installs without error.

Run:
```bash
cd apps/portal && npm run dev -- --port 5173 &
sleep 2 && curl -s http://localhost:5173 | grep -o '<title>[^<]*</title>'
kill %1
```
Expected output: `<title>AlgoLend</title>`

- [ ] **Step 10: Commit**

```bash
git add apps/portal
git commit -m "feat: scaffold apps/portal Vite + React + TypeScript app"
```

---

### Task 2: Theme color utilities (pure functions, ported from theme-runtime.js)

**Files:**
- Create: `apps/portal/src/theme/constants.ts`
- Create: `apps/portal/src/theme/colorUtils.ts`
- Create: `apps/portal/src/theme/colorUtils.test.ts`
- Create: `apps/portal/vitest.config.ts`
- Create: `apps/portal/tests/setup.ts`

- [ ] **Step 1: Create the Vitest config and test setup**

```typescript
// apps/portal/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true
  }
});
```

```typescript
// apps/portal/tests/setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Create theme constants and types**

```typescript
// apps/portal/src/theme/constants.ts
export interface CarouselSlide {
  title: string;
  text: string;
}

export interface SystemSettings {
  id: string;
  company_name: string;
  primary_color: string;
  secondary_color: string;
  tertiary_color: string;
  theme_mode: 'light' | 'dark';
  company_logo_url: string | null;
  auth_background_url: string | null;
  auth_background_flip: boolean;
  auth_overlay_color: string;
  auth_overlay_enabled: boolean;
  carousel_slides: CarouselSlide[];
  legal_entity_name?: string;
  company_reg_name?: string;
  fsp_number?: string;
  ncr_number?: string;
}

export const DEFAULT_CAROUSEL_SLIDES: CarouselSlide[] = [
  {
    title: 'Front End: Fully Branded Client Application Portal',
    text: 'Real-Time Affordability Intelligence (TruID Integration)\nCorporate Document Upload & E-Contracts'
  },
  {
    title: 'Back-End Risk & Compliance Engine',
    text: 'Instantly run real-time CIPC company checks, AML screening, director credit scoring, and biometric liveness checks at the point of application'
  },
  {
    title: 'Robust Operational Backbone',
    text: 'Mandate Control Room & Live Dry-Runs\nRisk-Based Pricing & Approval Hierarchies\nFull Audit Trail & Role-Based Access Logs'
  }
];

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  id: 'global',
  company_name: '',
  primary_color: '#B026FF',
  secondary_color: '#4A0E8F',
  tertiary_color: '#11022A',
  theme_mode: 'dark',
  company_logo_url: null,
  auth_background_url: null,
  auth_background_flip: false,
  auth_overlay_color: '#1E0B3B',
  auth_overlay_enabled: true,
  carousel_slides: DEFAULT_CAROUSEL_SLIDES.map((slide) => ({ ...slide }))
};
```

- [ ] **Step 3: Write the failing tests for the color utilities**

```typescript
// apps/portal/src/theme/colorUtils.test.ts
import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  adjustColor,
  getContrastColor,
  normalizeHexColor,
  normalizeTheme
} from './colorUtils';
import { DEFAULT_SYSTEM_SETTINGS } from './constants';

describe('hexToRgb', () => {
  it('parses a 6-digit hex color', () => {
    expect(hexToRgb('#7C3AED')).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('parses a 3-digit hex color by doubling each digit', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns black for an invalid or empty value', () => {
    expect(hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#zzzzzz')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('rgbToHex', () => {
  it('formats and uppercases the hex string', () => {
    expect(rgbToHex(124, 58, 237)).toBe('#7C3AED');
  });

  it('clamps out-of-range channel values', () => {
    expect(rgbToHex(300, -10, 128)).toBe('#FF0080');
  });
});

describe('adjustColor', () => {
  it('lightens toward white with a positive amount', () => {
    expect(adjustColor('#000000', 0.5)).toBe('#808080');
  });

  it('darkens toward black with a negative amount', () => {
    expect(adjustColor('#7C3AED', -1)).toBe('#000000');
  });

  it('returns the same color when amount is 0', () => {
    expect(adjustColor('#7C3AED', 0)).toBe('#7C3AED');
  });
});

describe('getContrastColor', () => {
  it('returns dark text for a light background', () => {
    expect(getContrastColor('#FFFFFF')).toBe('#0F172A');
  });

  it('returns light text for a dark background', () => {
    expect(getContrastColor('#000000')).toBe('#FFFFFF');
  });
});

describe('normalizeHexColor', () => {
  it('accepts a valid 6-digit hex and uppercases it', () => {
    expect(normalizeHexColor('#7c3aed', '#000000')).toBe('#7C3AED');
  });

  it('falls back for garbage input', () => {
    expect(normalizeHexColor('not-a-color', '#123456')).toBe('#123456');
  });

  it('falls back for empty input', () => {
    expect(normalizeHexColor('', '#123456')).toBe('#123456');
  });
});

describe('normalizeTheme', () => {
  it('fills in defaults for missing fields', () => {
    const result = normalizeTheme({});
    expect(result.primary_color).toBe(DEFAULT_SYSTEM_SETTINGS.primary_color);
    expect(result.carousel_slides).toHaveLength(3);
  });

  it('keeps valid overrides from the server payload', () => {
    const result = normalizeTheme({ primary_color: '#123456', theme_mode: 'light' });
    expect(result.primary_color).toBe('#123456');
    expect(result.theme_mode).toBe('light');
  });

  it('rejects an invalid overlay color and falls back to the default', () => {
    const result = normalizeTheme({ auth_overlay_color: 'nope' });
    expect(result.auth_overlay_color).toBe(DEFAULT_SYSTEM_SETTINGS.auth_overlay_color);
  });

  it('trims and defaults an empty company name', () => {
    const result = normalizeTheme({ company_name: '   ' });
    expect(result.company_name).toBe(DEFAULT_SYSTEM_SETTINGS.company_name);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd apps/portal && npx vitest run src/theme/colorUtils.test.ts`
Expected: FAIL — `Cannot find module './colorUtils'`

- [ ] **Step 5: Implement colorUtils.ts**

```typescript
// apps/portal/src/theme/colorUtils.ts
import { DEFAULT_SYSTEM_SETTINGS, DEFAULT_CAROUSEL_SLIDES, type SystemSettings, type CarouselSlide } from './constants';

export const clamp = (value: number, min = 0, max = 255): number =>
  Math.max(min, Math.min(max, value));

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  if (!hex) return { r: 0, g: 0, b: 0 };
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const intVal = parseInt(normalized, 16);
  if (Number.isNaN(intVal) || normalized.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255
  };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (c: number) => clamp(Math.round(c)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export const adjustColor = (hex: string, amount = 0): string => {
  const { r, g, b } = hexToRgb(hex);
  const delta = (channel: number) =>
    amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount);
  return rgbToHex(delta(r), delta(g), delta(b));
};

export const getContrastColor = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#0F172A' : '#FFFFFF';
};

export const normalizeBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
};

export const normalizeCompanyName = (value: unknown): string => {
  const name = typeof value === 'string' ? value.trim() : '';
  return name || DEFAULT_SYSTEM_SETTINGS.company_name;
};

export const normalizeHexColor = (value: unknown, fallback: string): string => {
  if (!value) return fallback;
  let hex = `${value}`.trim().replace('#', '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return fallback;
  }
  return `#${hex.toUpperCase()}`;
};

const sanitizeSlide = (slide: Partial<CarouselSlide> = {}, fallback: CarouselSlide): CarouselSlide => {
  const safeTitle = typeof slide.title === 'string' ? slide.title.trim() : '';
  const safeText = typeof slide.text === 'string' ? slide.text.trim() : '';
  return {
    title: safeTitle || fallback.title,
    text: safeText || fallback.text
  };
};

export const normalizeCarouselSlides = (slides: unknown): CarouselSlide[] => {
  const incoming = Array.isArray(slides) ? (slides as Partial<CarouselSlide>[]) : [];
  return DEFAULT_CAROUSEL_SLIDES.map((fallback, index) => sanitizeSlide(incoming[index] || {}, fallback));
};

export const normalizeTheme = (theme: Partial<SystemSettings> = {}): SystemSettings => ({
  ...DEFAULT_SYSTEM_SETTINGS,
  ...theme,
  company_name: normalizeCompanyName(theme?.company_name),
  auth_background_flip: normalizeBoolean(theme?.auth_background_flip, DEFAULT_SYSTEM_SETTINGS.auth_background_flip),
  auth_overlay_color: normalizeHexColor(theme?.auth_overlay_color, DEFAULT_SYSTEM_SETTINGS.auth_overlay_color),
  auth_overlay_enabled: normalizeBoolean(theme?.auth_overlay_enabled, DEFAULT_SYSTEM_SETTINGS.auth_overlay_enabled),
  carousel_slides: normalizeCarouselSlides(theme.carousel_slides)
});

export const computeCssVariables = (theme: SystemSettings): Record<string, string> => {
  const primaryRgb = hexToRgb(theme.primary_color);
  const secondaryRgb = hexToRgb(theme.secondary_color);
  const tertiaryRgb = hexToRgb(theme.tertiary_color);

  return {
    '--color-primary': theme.primary_color,
    '--color-primary-rgb': `${primaryRgb.r} ${primaryRgb.g} ${primaryRgb.b}`,
    '--color-primary-hover': adjustColor(theme.primary_color, -0.15),
    '--color-primary-soft': adjustColor(theme.primary_color, 0.2),
    '--color-primary-strong': adjustColor(theme.primary_color, -0.35),
    '--color-secondary': theme.secondary_color,
    '--color-secondary-rgb': `${secondaryRgb.r} ${secondaryRgb.g} ${secondaryRgb.b}`,
    '--color-secondary-soft': adjustColor(theme.secondary_color, 0.15),
    '--color-tertiary': theme.tertiary_color,
    '--color-tertiary-rgb': `${tertiaryRgb.r} ${tertiaryRgb.g} ${tertiaryRgb.b}`,
    '--gradient-brand': `linear-gradient(120deg, ${theme.primary_color}, ${theme.secondary_color}, ${theme.tertiary_color})`,
    '--color-primary-contrast': getContrastColor(theme.primary_color),
    '--auth-overlay-color': theme.auth_overlay_color,
    '--auth-overlay-enabled': theme.auth_overlay_enabled ? '1' : '0'
  };
};

export const applyCssVariables = (theme: SystemSettings): void => {
  const root = document.documentElement;
  const vars = computeCssVariables(theme);
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.setAttribute('data-theme', theme.theme_mode === 'dark' ? 'dark' : 'light');
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd apps/portal && npx vitest run src/theme/colorUtils.test.ts`
Expected: PASS — all 15 tests green

- [ ] **Step 7: Commit**

```bash
git add apps/portal/src/theme apps/portal/vitest.config.ts apps/portal/tests
git commit -m "feat: port theme color utilities from theme-runtime.js with tests"
```

---

### Task 3: ThemeProvider — fetches /api/system-settings and applies CSS variables

**Files:**
- Create: `apps/portal/src/theme/ThemeProvider.tsx`
- Create: `apps/portal/src/theme/ThemeProvider.test.tsx`
- Modify: `apps/portal/package.json` (add `@tanstack/react-query` usage — already a dependency from Task 1)

- [ ] **Step 1: Write the failing test**

```tsx
// apps/portal/src/theme/ThemeProvider.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, useTheme } from './ThemeProvider';

function TestConsumer() {
  const { theme, isLoading } = useTheme();
  if (isLoading) return <span>loading</span>;
  return <span>{theme.company_name || 'no-name'}</span>;
}

function renderWithProviders() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { company_name: 'AlgoLend', primary_color: '#123456' } })
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute('data-theme');
  });

  it('fetches the theme and exposes it via useTheme', async () => {
    renderWithProviders();
    await waitFor(() => expect(screen.getByText('AlgoLend')).toBeInTheDocument());
  });

  it('applies the fetched primary color as a CSS variable', async () => {
    renderWithProviders();
    await waitFor(() =>
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#123456')
    );
  });

  it('falls back to defaults when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    renderWithProviders();
    await waitFor(() => expect(screen.getByText('no-name')).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/portal && npx vitest run src/theme/ThemeProvider.test.tsx`
Expected: FAIL — `Cannot find module './ThemeProvider'`

- [ ] **Step 3: Implement ThemeProvider.tsx**

```tsx
// apps/portal/src/theme/ThemeProvider.tsx
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from './constants';
import { normalizeTheme, applyCssVariables } from './colorUtils';

const SETTINGS_ENDPOINT = '/api/system-settings';
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchSystemSettings(): Promise<SystemSettings> {
  const response = await fetch(SETTINGS_ENDPOINT, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to load theme (${response.status})`);
  }
  const payload = await response.json();
  return normalizeTheme(payload?.data || payload);
}

interface ThemeContextValue {
  theme: SystemSettings;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: fetchSystemSettings,
    staleTime: CACHE_TTL_MS,
    retry: false,
    placeholderData: normalizeTheme(DEFAULT_SYSTEM_SETTINGS)
  });

  const theme = data ?? normalizeTheme(DEFAULT_SYSTEM_SETTINGS);

  useEffect(() => {
    applyCssVariables(theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, isLoading }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/portal && npx vitest run src/theme/ThemeProvider.test.tsx`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/portal/src/theme
git commit -m "feat: add ThemeProvider fetching /api/system-settings"
```

---

### Task 4: Supabase client and typed API client (ported apiFetch with 401 retry)

**Files:**
- Create: `apps/portal/src/api/supabaseClient.ts`
- Create: `apps/portal/src/lib/navigation.ts`
- Create: `apps/portal/src/api/apiClient.ts`
- Create: `apps/portal/src/api/apiClient.test.ts`

- [ ] **Step 1: Create the Supabase client (no import-time side effects — see note below)**

```typescript
// apps/portal/src/api/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yakhrwrfmdrnhfgzfiwm.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlha2hyd3JmbWRybmhmZ3pmaXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMjAwMTYsImV4cCI6MjA5NTg5NjAxNn0.lgm1jvglC16RtqbGdiDNJcyLfobX-4F5AlKmoHZPCG4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
```

Note: the legacy `public/Services/supabaseClient.js` also registers a global `onAuthStateChange` listener at import time that redirects to login on `SIGNED_OUT`. This module intentionally does not — a module with import-time side effects can't be unit tested in isolation. That redirect behavior is implemented in Task 5's `useSession` hook instead, where it belongs with the rest of the session lifecycle.

- [ ] **Step 2: Create the navigation helper (isolates window.location for testability)**

```typescript
// apps/portal/src/lib/navigation.ts
export function redirectTo(path: string): void {
  window.location.replace(path);
}
```

- [ ] **Step 3: Write the failing tests for apiClient**

```typescript
// apps/portal/src/api/apiClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSession = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock('./supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args)
    }
  }
}));

const mockRedirectTo = vi.fn();
vi.mock('../lib/navigation', () => ({
  redirectTo: (...args: unknown[]) => mockRedirectTo(...args)
}));

import { apiFetch } from './apiClient';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('attaches the bearer token from the current session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'token-123' } } });
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/my-eligibility');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/my-eligibility',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-123' }) })
    );
    vi.unstubAllGlobals();
  });

  it('refreshes and retries once on a 401, then succeeds', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'expired-token' } } });
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'fresh-token' } } });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 401, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const response = await apiFetch('/api/my-eligibility');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/my-eligibility',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }) })
    );
    expect(response.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it('redirects to login when there is no session at all', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockRefreshSession.mockResolvedValue({ data: { session: null } });

    await expect(apiFetch('/api/my-eligibility')).rejects.toThrow('Session expired');
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
  });

  it('redirects to login when refresh-after-401 also fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'expired-token' } } });
    mockRefreshSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn().mockResolvedValue({ status: 401, ok: false });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/api/my-eligibility')).rejects.toThrow('Session expired');
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd apps/portal && npx vitest run src/api/apiClient.test.ts`
Expected: FAIL — `Cannot find module './apiClient'`

- [ ] **Step 5: Implement apiClient.ts**

```typescript
// apps/portal/src/api/apiClient.ts
import { supabase } from './supabaseClient';
import { redirectTo } from '../lib/navigation';

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;

  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed?.session?.access_token ?? null;
}

export async function apiFetch(path: string, options: RequestInit = {}, _retry = true): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    redirectTo('/auth/login');
    throw new Error('Session expired. Please log in again.');
  }

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  const response = await fetch(path, { ...options, headers });

  if (response.status === 401 && _retry) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) {
      return apiFetch(path, options, false);
    }
    redirectTo('/auth/login');
    throw new Error('Session expired. Please log in again.');
  }

  if (response.status === 401) {
    redirectTo('/auth/login');
    throw new Error('Session expired. Please log in again.');
  }

  return response;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/portal && npx vitest run src/api/apiClient.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 7: Commit**

```bash
git add apps/portal/src/api apps/portal/src/lib
git commit -m "feat: add Supabase client and typed apiFetch with 401 refresh-and-retry"
```

---

### Task 5: Role hierarchy and admin-access resolution

**Files:**
- Create: `apps/portal/src/auth/roles.ts`
- Create: `apps/portal/src/auth/roles.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/portal/src/auth/roles.test.ts
import { describe, it, expect, vi } from 'vitest';
import { hasMinimumRole, resolveAdminAccess, type MinimalSession } from './roles';

describe('hasMinimumRole', () => {
  it('returns true when the role level meets the minimum', () => {
    expect(hasMinimumRole('super_admin', 'base_admin')).toBe(true);
    expect(hasMinimumRole('admin', 'admin')).toBe(true);
  });

  it('returns false when the role level is below the minimum', () => {
    expect(hasMinimumRole('borrower', 'base_admin')).toBe(false);
    expect(hasMinimumRole('support', 'admin')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(hasMinimumRole('SUPER_ADMIN', 'base_admin')).toBe(true);
  });

  it('treats an unknown or missing role as level 0', () => {
    expect(hasMinimumRole('', 'base_admin')).toBe(false);
    expect(hasMinimumRole('made_up_role', 'base_admin')).toBe(false);
  });
});

describe('resolveAdminAccess', () => {
  it('grants access from the JWT app_metadata role without calling the RPC', async () => {
    const rpc = vi.fn();
    const session = { user: { app_metadata: { role: 'super_admin' }, user_metadata: {} } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(result).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('falls back to user_metadata role when app_metadata has none', async () => {
    const rpc = vi.fn();
    const session = { user: { app_metadata: {}, user_metadata: { role: 'admin' } } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(result).toBe(true);
  });

  it('falls back to the RPC when the JWT role is insufficient', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const session = { user: { app_metadata: { role: 'borrower' }, user_metadata: {} } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(rpc).toHaveBeenCalledWith('is_role_or_higher', { p_min_role: 'base_admin' });
    expect(result).toBe(true);
  });

  it('returns false when both the JWT role and the RPC deny access', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const session = { user: { app_metadata: { role: 'borrower' }, user_metadata: {} } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(result).toBe(false);
  });

  it('returns false when there is no session at all', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });

    const result = await resolveAdminAccess(null, { rpc }, 'base_admin');

    expect(result).toBe(false);
  });

  it('returns false when the RPC errors', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('rpc down') });
    const session = { user: { app_metadata: { role: 'borrower' }, user_metadata: {} } } as MinimalSession;

    const result = await resolveAdminAccess(session, { rpc }, 'base_admin');

    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/portal && npx vitest run src/auth/roles.test.ts`
Expected: FAIL — `Cannot find module './roles'`

- [ ] **Step 3: Implement roles.ts**

```typescript
// apps/portal/src/auth/roles.ts
export interface MinimalSession {
  user?: {
    app_metadata?: { role?: string };
    user_metadata?: { role?: string };
  };
}

interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
}

const ADMIN_ROLE_LEVELS: Record<string, number> = {
  borrower: 0,
  user: 0,
  support: 1,
  admin: 2,
  base_admin: 2,
  super_admin: 3,
  owner: 4
};

export function hasMinimumRole(role: string, minimumRole = 'base_admin'): boolean {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedMinimum = String(minimumRole || 'base_admin').trim().toLowerCase();
  const roleLevel = ADMIN_ROLE_LEVELS[normalizedRole] ?? 0;
  const minimumLevel = ADMIN_ROLE_LEVELS[normalizedMinimum] ?? 2;
  return roleLevel >= minimumLevel;
}

export async function resolveAdminAccess(
  session: MinimalSession | null,
  client: RpcClient,
  minimumRole = 'base_admin'
): Promise<boolean> {
  const jwtRole = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || '';
  if (jwtRole && hasMinimumRole(jwtRole, minimumRole)) {
    return true;
  }

  const { data: rpcAllowed, error: rpcError } = await client.rpc('is_role_or_higher', {
    p_min_role: minimumRole
  });

  if (!rpcError) {
    return Boolean(rpcAllowed);
  }

  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/portal && npx vitest run src/auth/roles.test.ts`
Expected: PASS — all 8 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/portal/src/auth/roles.ts apps/portal/src/auth/roles.test.ts
git commit -m "feat: port role hierarchy and admin-access resolution with tests"
```

---

### Task 6: Minimal shadcn-pattern UI primitives

**Files:**
- Create: `apps/portal/src/lib/utils.ts`
- Create: `apps/portal/src/components/ui/button.tsx`
- Create: `apps/portal/src/components/ui/input.tsx`
- Create: `apps/portal/src/components/ui/label.tsx`
- Create: `apps/portal/src/components/ui/alert.tsx`

- [ ] **Step 1: Create the cn() class-merge helper**

```typescript
// apps/portal/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create the Button primitive**

```tsx
// apps/portal/src/components/ui/button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-contrast hover:bg-primary-hover',
        outline: 'border border-gray-200 bg-white text-gray-900 hover:bg-gray-50',
        ghost: 'text-primary hover:bg-primary/10'
      },
      size: {
        default: 'h-11 px-4 py-2.5',
        sm: 'h-9 px-3',
        lg: 'h-12 px-6 text-base'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';
```

- [ ] **Step 3: Create the Input and Label primitives**

```tsx
// apps/portal/src/components/ui/input.tsx
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-11 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';
```

```tsx
// apps/portal/src/components/ui/label.tsx
import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('mb-1 block text-xs font-bold uppercase tracking-wide text-gray-600', className)} {...props} />
));
Label.displayName = 'Label';
```

- [ ] **Step 4: Create the Alert primitive (for form error/success banners)**

```tsx
// apps/portal/src/components/ui/alert.tsx
import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Alert({ variant = 'error', children }: { variant?: 'error' | 'success'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'mb-4 rounded-xl border p-3 text-sm',
        variant === 'error' && 'border-red-200 bg-red-50 text-red-700',
        variant === 'success' && 'border-green-200 bg-green-50 text-green-700'
      )}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 5: Verify the app still builds with the new components**

Run: `cd apps/portal && npx tsc -b --noEmit`
Expected: no type errors

- [ ] **Step 6: Commit**

```bash
git add apps/portal/src/lib/utils.ts apps/portal/src/components
git commit -m "feat: add shadcn-pattern Button, Input, Label, Alert primitives"
```

---

### Task 7: AuthPage — login / signup / forgot-password

**Files:**
- Create: `apps/portal/src/auth/AuthPage.tsx`
- Create: `apps/portal/src/auth/AuthPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/portal/src/auth/AuthPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn(() => ({ insert: vi.fn().mockResolvedValue({}) }));

vi.mock('../api/supabaseClient', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args)
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args)
  }
}));

const mockRedirectTo = vi.fn();
vi.mock('../lib/navigation', () => ({
  redirectTo: (...args: unknown[]) => mockRedirectTo(...args)
}));

import { AuthPage } from './AuthPage';

function renderAuthPage() {
  return render(
    <MemoryRouter>
      <AuthPage />
    </MemoryRouter>
  );
}

describe('AuthPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the login form by default', () => {
    renderAuthPage();
    expect(screen.getByRole('heading', { name: 'Welcome Back!' })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });

  it('logs in a borrower and redirects to the portal dashboard', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { user: { app_metadata: { role: 'borrower' }, user_metadata: {} } } },
      error: null
    });

    renderAuthPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'sup3rSecret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(mockRedirectTo).toHaveBeenCalledWith('/user-portal/dashboard'));
  });

  it('logs in an admin and redirects to the admin dashboard', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: { session: { user: { app_metadata: { role: 'super_admin' }, user_metadata: {} } } },
      error: null
    });

    renderAuthPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'admin@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'sup3rSecret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(mockRedirectTo).toHaveBeenCalledWith('/admin/dashboard'));
  });

  it('shows an error message when login fails', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: { message: 'Invalid login credentials' } });

    renderAuthPage();
    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(screen.getByText('Invalid login credentials')).toBeInTheDocument());
  });

  it('switches to the signup view and creates a profile row on success', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'user-1', email: 'new@example.com' } }, error: null });

    renderAuthPage();
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe');
    await userEvent.type(screen.getByLabelText(/email address/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'sup3rSecret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'sup3rSecret',
        options: { data: { full_name: 'Jane Doe' } }
      })
    );
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('switches to forgot-password and redirects the reset link to set-password (bug fix)', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    renderAuthPage();
    await userEvent.click(screen.getByRole('button', { name: 'Forgot Password?' }));
    expect(screen.getByRole('heading', { name: 'Forgot Password' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() =>
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('jane@example.com', {
        redirectTo: expect.stringContaining('/auth/set-password')
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/portal && npx vitest run src/auth/AuthPage.test.tsx`
Expected: FAIL — `Cannot find module './AuthPage'`

- [ ] **Step 3: Add react-router-dom's test utilities and user-event as dev dependencies**

```bash
cd apps/portal && npm install -D @testing-library/user-event
```

- [ ] **Step 4: Implement AuthPage.tsx**

```tsx
// apps/portal/src/auth/AuthPage.tsx
import { useState, type FormEvent } from 'react';
import { supabase } from '../api/supabaseClient';
import { redirectTo } from '../lib/navigation';
import { hasMinimumRole, type MinimalSession } from './roles';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert } from '../components/ui/alert';

type ViewState = 'login' | 'signup' | 'forgot';

interface FormMessage {
  type: 'success' | 'error' | '';
  text: string;
}

const COPY: Record<ViewState, { heading: string; sub: string; button: string }> = {
  login: { heading: 'Welcome Back!', sub: 'Sign in to your account', button: 'Sign In' },
  signup: { heading: 'Create Account', sub: 'Enter your details to get started', button: 'Sign Up' },
  forgot: { heading: 'Forgot Password', sub: 'Enter your email to receive a reset link', button: 'Send Reset Link' }
};

async function resolveRedirectPath(session: MinimalSession): Promise<string> {
  const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || '';
  return hasMinimumRole(role, 'base_admin') ? '/admin/dashboard' : '/user-portal/dashboard';
}

export function AuthPage() {
  const [view, setView] = useState<ViewState>('login');
  const [message, setMessage] = useState<FormMessage>({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;

    try {
      if (view === 'login') {
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const redirectPath = await resolveRedirectPath(data.session as unknown as MinimalSession);
        redirectTo(redirectPath);
      } else if (view === 'signup') {
        const password = (form.elements.namedItem('password') as HTMLInputElement).value;
        const fullName = (form.elements.namedItem('fullName') as HTMLInputElement).value;

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } }
        });
        if (error) throw error;

        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            full_name: fullName,
            email: data.user.email,
            role: 'borrower'
          });
          setView('login');
          setMessage({
            type: 'success',
            text: 'Account created! Check your email to confirm. After confirming your email and logging in, you will be required to complete BOTH Financial Information and Declarations to unlock the user portal.'
          });
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/set-password`
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Password reset link sent to your email.' });
        setView('login');
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Something went wrong.' });
    } finally {
      setSubmitting(false);
    }
  }

  const copy = COPY[view];

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FDF9F6] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <img src="/algolend-logo.png" alt="AlgoLend" className="h-14 object-contain" />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-2xl font-black text-gray-900">{copy.heading}</h2>
          <p className="mb-6 text-sm text-gray-500">{copy.sub}</p>

          {message.text && <Alert variant={message.type === 'success' ? 'success' : 'error'}>{message.text}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {view === 'signup' && (
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" name="fullName" type="text" required placeholder="John Smith" />
              </div>
            )}

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="info@example.com" />
            </div>

            {view !== 'forgot' && (
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={6}
                  placeholder="••••••••"
                />
              </div>
            )}

            {view === 'login' && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-600">
                  <input type="checkbox" defaultChecked /> Remember me
                </label>
                <button type="button" className="font-bold text-primary" onClick={() => setView('forgot')}>
                  Forgot Password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {copy.button}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {view === 'login' && (
              <>
                Don&apos;t have an account?{' '}
                <button type="button" className="font-bold text-primary" onClick={() => setView('signup')}>
                  Register
                </button>
              </>
            )}
            {view === 'signup' && (
              <>
                Already have an account?{' '}
                <button type="button" className="font-bold text-primary" onClick={() => setView('login')}>
                  Login
                </button>
              </>
            )}
            {view === 'forgot' && (
              <>
                Remembered your password?{' '}
                <button type="button" className="font-bold text-primary" onClick={() => setView('login')}>
                  Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/portal && npx vitest run src/auth/AuthPage.test.tsx`
Expected: PASS — all 6 tests green

- [ ] **Step 6: Commit**

```bash
git add apps/portal/src/auth/AuthPage.tsx apps/portal/src/auth/AuthPage.test.tsx apps/portal/package.json apps/portal/package-lock.json
git commit -m "feat: port login/signup/forgot-password AuthPage, fix reset-link 404 bug"
```

---

### Task 8: SetPasswordPage — invite and password-recovery flow

**Files:**
- Create: `apps/portal/src/auth/SetPasswordPage.tsx`
- Create: `apps/portal/src/auth/SetPasswordPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// apps/portal/src/auth/SetPasswordPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockUpdateUser = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args)
    }
  }
}));

const mockRedirectTo = vi.fn();
vi.mock('../lib/navigation', () => ({
  redirectTo: (...args: unknown[]) => mockRedirectTo(...args)
}));

import { SetPasswordPage } from './SetPasswordPage';

describe('SetPasswordPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('shows the form immediately when a session already exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(
      <MemoryRouter>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByLabelText(/new password/i)).toBeInTheDocument());
  });

  it('shows an expired-link error when no session appears within the timeout', async () => {
    vi.useFakeTimers();
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(
      <MemoryRouter>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.getByText(/link expired or invalid/i)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('rejects a password shorter than 8 characters', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(
      <MemoryRouter>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByLabelText(/new password/i));

    await userEvent.type(screen.getByLabelText(/new password/i), 'short');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(
      <MemoryRouter>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByLabelText(/new password/i));

    await userEvent.type(screen.getByLabelText(/new password/i), 'longenough1');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'longenough2');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('submits the new password and redirects a borrower to the portal dashboard', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
    mockUpdateUser.mockResolvedValue({ error: null });
    mockGetUser.mockResolvedValue({ data: { user: { app_metadata: { role: 'borrower' } } } });

    render(
      <MemoryRouter initialEntries={['/auth/set-password']}>
        <SetPasswordPage />
      </MemoryRouter>
    );
    await waitFor(() => screen.getByLabelText(/new password/i));

    await userEvent.type(screen.getByLabelText(/new password/i), 'longenough1');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'longenough1');
    await userEvent.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'longenough1' }));
    await waitFor(() => expect(screen.getByText(/password set/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/portal && npx vitest run src/auth/SetPasswordPage.test.tsx`
Expected: FAIL — `Cannot find module './SetPasswordPage'`

- [ ] **Step 3: Implement SetPasswordPage.tsx**

```tsx
// apps/portal/src/auth/SetPasswordPage.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../api/supabaseClient';
import { redirectTo } from '../lib/navigation';
import { hasMinimumRole } from './roles';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert } from '../components/ui/alert';

type State = 'loading' | 'form' | 'success' | 'error';

export function SetPasswordPage() {
  const [state, setState] = useState<State>('loading');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let settled = false;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        settled = true;
        setState('form');
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        settled = true;
        setState('form');
      }
    });

    const timeout = setTimeout(() => {
      if (!settled) setState('error');
    }, 3000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');

    const form = e.currentTarget;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value;

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setFormError(error.message);
      setSubmitting(false);
      return;
    }

    setState('success');
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const role = user?.app_metadata?.role || user?.user_metadata?.role || 'borrower';
    const nextParam = searchParams.get('next');
    const destination = nextParam
      ? decodeURIComponent(nextParam)
      : hasMinimumRole(role, 'base_admin')
        ? '/admin/dashboard'
        : '/user-portal/dashboard';

    setTimeout(() => redirectTo(destination), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <img src="/algolend-logo.png" alt="AlgoLend" className="h-14 object-contain" />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          {state === 'loading' && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
              <p className="text-sm text-gray-500">Verifying your invite link…</p>
            </div>
          )}

          {state === 'form' && (
            <>
              <h1 className="mb-1 text-xl font-black text-gray-900">Welcome to AlgoLend</h1>
              <p className="mb-6 text-sm text-gray-500">Set a password to secure your account.</p>
              {formError && <Alert variant="error">{formError}</Alert>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <Input id="password" name="password" type="password" required minLength={8} placeholder="Min 8 characters" />
                </div>
                <div>
                  <Label htmlFor="confirm">Confirm Password</Label>
                  <Input id="confirm" name="confirm" type="password" required minLength={8} placeholder="Repeat password" />
                </div>
                <Button type="submit" className="mt-2 w-full" disabled={submitting}>
                  Set Password & Continue
                </Button>
              </form>
            </>
          )}

          {state === 'success' && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
                <svg className="h-7 w-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="mb-1 text-lg font-black text-gray-900">Password set!</h2>
              <p className="text-sm text-gray-500">Redirecting you to the dashboard…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="mb-1 text-lg font-black text-gray-900">Link expired or invalid</h2>
              <p className="mb-4 text-sm text-gray-500">Ask your administrator to resend the invite.</p>
              <a href="/auth/login" className="text-sm font-bold text-primary hover:underline">
                Go to Login
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/portal && npx vitest run src/auth/SetPasswordPage.test.tsx`
Expected: PASS — all 5 tests green

- [ ] **Step 5: Commit**

```bash
git add apps/portal/src/auth/SetPasswordPage.tsx apps/portal/src/auth/SetPasswordPage.test.tsx
git commit -m "feat: port set-password invite/recovery flow"
```

---

### Task 9: Session guard hook and ProtectedRoute

**Files:**
- Create: `apps/portal/src/auth/useSession.ts`
- Create: `apps/portal/src/auth/useSession.test.tsx`
- Create: `apps/portal/src/auth/ProtectedRoute.tsx`

- [ ] **Step 1: Write the failing tests for useSession**

```tsx
// apps/portal/src/auth/useSession.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockSignOut = vi.fn();

vi.mock('../api/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args)
    }
  }
}));

const mockRedirectTo = vi.fn();
vi.mock('../lib/navigation', () => ({
  redirectTo: (...args: unknown[]) => mockRedirectTo(...args)
}));

import { useSession } from './useSession';

describe('useSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockOnAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it('redirects to login when there is no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
  });

  it('signs out and redirects when the role is not an allowed portal role', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', app_metadata: { role: 'unknown_role' } } } },
      error: null
    });
    mockSignOut.mockResolvedValue({});
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'));
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
  });

  it('exposes an authenticated status and session for an allowed role', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', app_metadata: { role: 'borrower' } } } },
      error: null
    });
    const { result } = renderHook(() => useSession());

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.session?.user.id).toBe('u1');
    expect(mockRedirectTo).not.toHaveBeenCalled();
  });

  it('redirects to login when SIGNED_OUT fires', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', app_metadata: { role: 'borrower' } } } },
      error: null
    });
    let capturedCallback: ((event: string) => void) | undefined;
    mockOnAuthStateChange.mockImplementation((cb: (event: string) => void) => {
      capturedCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    capturedCallback?.('SIGNED_OUT');
    expect(mockRedirectTo).toHaveBeenCalledWith('/auth/login');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/portal && npx vitest run src/auth/useSession.test.tsx`
Expected: FAIL — `Cannot find module './useSession'`

- [ ] **Step 3: Implement useSession.ts**

```typescript
// apps/portal/src/auth/useSession.ts
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabaseClient';
import { redirectTo } from '../lib/navigation';

const ALLOWED_PORTAL_ROLES = ['borrower', 'super_admin', 'admin', 'base_admin', 'owner'];

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionState {
  status: SessionStatus;
  session: Session | null;
}

function roleOf(session: Session | null): string {
  return session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || 'borrower';
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

  useEffect(() => {
    let cancelled = false;

    async function evaluate(session: Session | null) {
      if (!session) {
        if (!cancelled) setState({ status: 'unauthenticated', session: null });
        redirectTo('/auth/login');
        return;
      }

      const role = roleOf(session);
      if (!ALLOWED_PORTAL_ROLES.includes(role)) {
        await supabase.auth.signOut();
        if (!cancelled) setState({ status: 'unauthenticated', session: null });
        redirectTo('/auth/login');
        return;
      }

      if (!cancelled) setState({ status: 'authenticated', session });
    }

    supabase.auth.getSession().then(({ data: { session } }) => evaluate(session));

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setState({ status: 'unauthenticated', session: null });
        redirectTo('/auth/login');
        return;
      }
      evaluate(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/portal && npx vitest run src/auth/useSession.test.tsx`
Expected: PASS — all 4 tests green

- [ ] **Step 5: Implement ProtectedRoute.tsx (no separate test — it's a thin wrapper over the tested useSession hook)**

```tsx
// apps/portal/src/auth/ProtectedRoute.tsx
import type { ReactNode } from 'react';
import { useSession } from './useSession';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-500" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/portal/src/auth/useSession.ts apps/portal/src/auth/useSession.test.tsx apps/portal/src/auth/ProtectedRoute.tsx
git commit -m "feat: port session guard as useSession hook + ProtectedRoute"
```

---

### Task 10: Portal layout, page-redirect shim, and placeholder dashboard

**Files:**
- Create: `apps/portal/src/layout/PortalLayout.tsx`
- Create: `apps/portal/src/layout/PageRedirect.tsx`
- Create: `apps/portal/src/layout/PageRedirect.test.tsx`
- Create: `apps/portal/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Write the failing test for the ?page= redirect shim**

```tsx
// apps/portal/src/layout/PageRedirect.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PageRedirect } from './PageRedirect';

function DashboardStub() {
  return <span>dashboard-page</span>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/user-portal" element={<PageRedirect />} />
        <Route path="/user-portal/dashboard" element={<DashboardStub />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PageRedirect', () => {
  it('maps ?page=dashboard to /user-portal/dashboard', () => {
    renderAt('/user-portal?page=dashboard');
    expect(screen.getByText('dashboard-page')).toBeInTheDocument();
  });

  it('defaults to the dashboard when there is no ?page param', () => {
    renderAt('/user-portal');
    expect(screen.getByText('dashboard-page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/portal && npx vitest run src/layout/PageRedirect.test.tsx`
Expected: FAIL — `Cannot find module './PageRedirect'`

- [ ] **Step 3: Implement PageRedirect.tsx**

```tsx
// apps/portal/src/layout/PageRedirect.tsx
import { Navigate, useSearchParams } from 'react-router-dom';

export function PageRedirect() {
  const [searchParams] = useSearchParams();
  const page = searchParams.get('page') || 'dashboard';
  return <Navigate to={`/user-portal/${page}`} replace />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/portal && npx vitest run src/layout/PageRedirect.test.tsx`
Expected: PASS — both tests green

- [ ] **Step 5: Implement PortalLayout.tsx**

```tsx
// apps/portal/src/layout/PortalLayout.tsx
import type { ReactNode } from 'react';
import { supabase } from '../api/supabaseClient';
import { Button } from '../components/ui/button';

export function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <img src="/algolend-logo.png" alt="AlgoLend" className="h-8 object-contain" />
        <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
          Sign Out
        </Button>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Implement the placeholder DashboardPage (proves the whole chain end-to-end)**

```tsx
// apps/portal/src/pages/DashboardPage.tsx
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/apiClient';

interface EligibilityResponse {
  eligible: boolean;
  reason?: string;
}

async function fetchEligibility(): Promise<EligibilityResponse> {
  const response = await apiFetch('/api/my-eligibility');
  if (!response.ok) throw new Error(`Failed to load eligibility (${response.status})`);
  return response.json();
}

export function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-eligibility'],
    queryFn: fetchEligibility
  });

  return (
    <div>
      <h1 className="mb-4 text-2xl font-black text-gray-900">Dashboard</h1>
      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      {isError && <p className="text-sm text-red-600">Could not load your eligibility.</p>}
      {data && (
        <p className="text-sm text-gray-700">
          {data.eligible ? 'You are eligible for a loan.' : `Not yet eligible (${data.reason ?? 'unknown reason'}).`}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/portal/src/layout apps/portal/src/pages
git commit -m "feat: add portal layout, ?page= redirect shim, placeholder dashboard"
```

---

### Task 11: Wire App.tsx with routing and providers

**Files:**
- Modify: `apps/portal/src/App.tsx`
- Modify: `apps/portal/src/main.tsx`

- [ ] **Step 1: Rewrite App.tsx with the full route tree**

```tsx
// apps/portal/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme/ThemeProvider';
import { AuthPage } from './auth/AuthPage';
import { SetPasswordPage } from './auth/SetPasswordPage';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { PortalLayout } from './layout/PortalLayout';
import { PageRedirect } from './layout/PageRedirect';
import { DashboardPage } from './pages/DashboardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 }
  }
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth/login" element={<AuthPage />} />
            <Route path="/auth/set-password" element={<SetPasswordPage />} />
            <Route path="/user-portal" element={<PageRedirect />} />
            <Route
              path="/user-portal/dashboard"
              element={
                <ProtectedRoute>
                  <PortalLayout>
                    <DashboardPage />
                  </PortalLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Simplify main.tsx (unchanged from Task 1, confirm it still matches)**

```tsx
// apps/portal/src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Run the full test suite**

Run: `cd apps/portal && npx vitest run`
Expected: PASS — all tests across all files green (theme, api, auth, layout)

- [ ] **Step 4: Type-check the whole app**

Run: `cd apps/portal && npx tsc -b --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add apps/portal/src/App.tsx apps/portal/src/main.tsx
git commit -m "feat: wire portal routing — auth, set-password, ?page= shim, protected dashboard"
```

---

### Task 12: Manual verification against the live Express + Supabase backend

**Files:** none (verification only)

- [ ] **Step 1: Start the existing Express server**

Run (in one terminal): `cd /Users/kurtvonschaeffer/Algolend && node server.js`
Expected: `Server started successfully on port 3002` (or equivalent existing startup log)

- [ ] **Step 2: Start the portal dev server**

Run (in another terminal): `cd apps/portal && npm run dev`
Expected: Vite prints `Local: http://localhost:5173/`

- [ ] **Step 3: Verify the login page renders with live theme data**

Using the browser preview tools: navigate to `http://localhost:5173/auth/login`, take a snapshot, and confirm:
- The heading reads "Welcome Back!"
- `document.documentElement.style.getPropertyValue('--color-primary')` equals the value currently returned by `curl -s http://localhost:3002/api/system-settings` (not a hardcoded default) — check via `preview_eval`.

- [ ] **Step 4: Verify a real login redirects correctly**

Using the preview tools, fill in valid borrower credentials on the login form and submit. Confirm the browser navigates to `/user-portal/dashboard` and the placeholder dashboard renders either "You are eligible for a loan." or the "Not yet eligible" message (proves the JWT reached Express and `/api/my-eligibility` responded).

- [ ] **Step 5: Verify the ?page= shim**

Navigate to `http://localhost:5173/user-portal?page=dashboard` directly and confirm it redirects to `/user-portal/dashboard` and renders correctly (this is the URL shape existing push notifications and emails already use).

- [ ] **Step 6: Verify session-guard redirect**

Using `preview_eval`, run `localStorage.clear()` then reload `/user-portal/dashboard` directly. Confirm it redirects to `/auth/login` instead of showing the dashboard.

- [ ] **Step 7: Record results**

No commit for this task — it is a verification checkpoint. If any step fails, return to the relevant earlier task, fix, and re-run this task from Step 1.

---

## Plan self-review notes

- **Spec coverage:** This plan implements the "Shell + auth" slice from the design doc's page inventory (Slice 1) in full: login/signup/forgot/set-password, session guard, theme provider, and a working route tree. It intentionally stops before Slice 2 (dashboard/calculator/notifications/etc.) — those get their own plan once this lands, per the design's phased rollout and this skill's scope-check rule. Service-worker/push registration (also mentioned in Slice 1 of the design) is deferred to the plan for Slice 2, since it is meaningless without the notifications page it triggers navigation to — building it here would mean testing against a route that doesn't exist yet.
- **Type consistency check:** `MinimalSession` (Task 5) is reused as-is in `AuthPage.tsx` (Task 7) and `useSession.ts` uses the real Supabase `Session` type instead — verified this is intentional: `useSession` operates on a live Supabase session object, while `roles.ts` only needs the two metadata fields and stays decoupled from the Supabase SDK type so it has zero import dependencies (easier to unit test, matches its "pure logic" role). `redirectTo` signature `(path: string) => void` is consistent everywhere it's called (apiClient, AuthPage, SetPasswordPage, useSession).
- **Bug fix carried through:** the `/auth/update-password.html` 404 is fixed in Task 7 (AuthPage's forgot-password handler now targets `/auth/set-password`), and Task 8's tests confirm `/auth/set-password` correctly handles both `SIGNED_IN` (invite) and `PASSWORD_RECOVERY` (reset) events, so both flows land on a working page.
