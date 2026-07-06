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
