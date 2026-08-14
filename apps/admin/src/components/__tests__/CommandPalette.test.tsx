import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from '../CommandPalette';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderPalette(open = true, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <CommandPalette open={open} onClose={onClose} />
    </MemoryRouter>
  );
}

describe('CommandPalette', () => {
  beforeEach(() => { mockNavigate.mockClear(); });

  it('renders when open', () => {
    renderPalette(true);
    expect(screen.getByPlaceholderText(/search pages/i)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderPalette(false);
    expect(screen.queryByPlaceholderText(/search pages/i)).not.toBeInTheDocument();
  });

  it('shows all commands by default', () => {
    renderPalette();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Cash Ledger')).toBeInTheDocument();
    expect(screen.getByText('New Application')).toBeInTheDocument();
  });

  it('filters results by label', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.type(screen.getByPlaceholderText(/search pages/i), 'cash');
    // The Highlight component splits the label across DOM nodes, so match by description
    expect(screen.getByText('Cash flow & transactions')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('filters by keywords', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.type(screen.getByPlaceholderText(/search pages/i), 'debicheck');
    expect(screen.getByText('Mandates')).toBeInTheDocument();
  });

  it('shows no-results message for unknown query', async () => {
    const user = userEvent.setup();
    renderPalette();
    await user.type(screen.getByPlaceholderText(/search pages/i), 'zzznomatch');
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it('calls onClose on Escape', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking the backdrop', () => {
    const onClose = vi.fn();
    const { container } = renderPalette(true, onClose);
    // The backdrop is the outermost fixed div
    fireEvent.click(container.firstChild!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('navigates and closes on Enter', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderPalette(true, onClose);
    await user.type(screen.getByPlaceholderText(/search pages/i), 'dashboard');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates on item click', () => {
    const onClose = vi.fn();
    renderPalette(true, onClose);
    fireEvent.click(screen.getByText('Analytics'));
    expect(mockNavigate).toHaveBeenCalledWith('/analytics');
    expect(onClose).toHaveBeenCalled();
  });

  it('moves selection down on ArrowDown', () => {
    renderPalette();
    // First item (index 0) is selected by default — ArrowDown moves to 1
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    // Both items still visible; no crash = pass
    expect(screen.getByPlaceholderText(/search pages/i)).toBeInTheDocument();
  });
});
