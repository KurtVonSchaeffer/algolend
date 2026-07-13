import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../api/supabaseClient';
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from './constants';
import { normalizeTheme, applyCssVariables } from './colorUtils';

const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchSystemSettings(): Promise<SystemSettings> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', 'global')
    .maybeSingle();

  if (error) throw error;
  return normalizeTheme(data ?? {});
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

  const theme = useMemo(() => data ?? normalizeTheme(DEFAULT_SYSTEM_SETTINGS), [data]);

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
