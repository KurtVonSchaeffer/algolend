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
