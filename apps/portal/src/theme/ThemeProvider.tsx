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
