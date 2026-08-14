import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DemoPage } from '../DemoPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderDemo() {
  return render(
    <MemoryRouter>
      <DemoPage />
    </MemoryRouter>
  );
}

describe('DemoPage', () => {
  beforeEach(() => { localStorage.clear(); mockNavigate.mockClear(); vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders the enter demo button', () => {
    renderDemo();
    expect(screen.getByRole('button', { name: /enter demo/i })).toBeInTheDocument();
  });

  it('shows all feature categories', () => {
    renderDemo();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Applications')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
  });

  it('sets demo flag and navigates on button click', () => {
    renderDemo();
    fireEvent.click(screen.getByRole('button', { name: /enter demo/i }));
    expect(localStorage.getItem('algolend_demo')).toBe('1');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('auto-navigates after countdown', async () => {
    const { act } = await import('@testing-library/react');
    renderDemo();
    // Each countdown tick is one 1000ms timer; each setState re-runs the effect,
    // so we must flush React state after every tick.
    for (let i = 0; i < 6; i++) {
      await act(async () => { vi.advanceTimersByTime(1000); });
    }
    expect(localStorage.getItem('algolend_demo')).toBe('1');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('displays countdown', () => {
    renderDemo();
    expect(screen.getByText(/5s/)).toBeInTheDocument();
  });
});
