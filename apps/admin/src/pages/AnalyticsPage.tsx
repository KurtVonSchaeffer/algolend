import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRevenueAnalytics } from '../services/adminData';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

type Row = {
  loan_id: string | number;
  customer: string;
  month: string;
  principal: number;
  interest: number;
  fees: number;
  arrears: number;
  status: string;
  created_at: string;
  user_id: string;
};

type SortMode = 'date_desc' | 'date_asc' | 'principal_desc' | 'principal_asc';
type Period = 'current_month' | 'last_3_months' | 'ytd' | 'all';

const SORT_LABELS: Record<SortMode, string> = {
  date_desc: 'Date (Newest)',
  date_asc: 'Date (Oldest)',
  principal_desc: 'Principal (High)',
  principal_asc: 'Principal (Low)',
};
const SORT_CYCLE: SortMode[] = ['date_desc', 'date_asc', 'principal_desc', 'principal_asc'];

function exportCsv(rows: Row[]) {
  const headers = ['Loan ID', 'Customer', 'Month', 'Principal (ZAR)', 'Interest (ZAR)', 'Fees (ZAR)', 'Arrears (ZAR)'];
  const lines = rows.map(r =>
    [r.loan_id, r.customer, r.month, r.principal, r.interest, r.fees, r.arrears].join(',')
  );
  const blob = new Blob(['﻿' + [headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `algolend_revenue_analytics.csv`;
  a.click();
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('all');
  const [search, setSearch] = useState('');
  const [filterArrears, setFilterArrears] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('date_desc');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['revenue-analytics'],
    queryFn: fetchRevenueAnalytics,
    staleTime: 60_000,
  });

  const allRows: Row[] = data?.data ?? [];

  const filtered = useMemo(() => {
    const now = new Date();
    let rows = allRows.filter(r => {
      if (!r.month) return true;
      if (period === 'all') return true;
      const [y, m] = r.month.split('-').map(Number);
      const d = new Date(y, m - 1, 1);
      if (period === 'current_month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === 'last_3_months') return d >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
      if (period === 'ytd') return y === now.getFullYear();
      return true;
    });

    if (search) {
      const t = search.toLowerCase();
      rows = rows.filter(r =>
        String(r.loan_id).toLowerCase().includes(t) ||
        r.customer.toLowerCase().includes(t)
      );
    }

    if (filterArrears) rows = rows.filter(r => r.arrears > 0);

    rows.sort((a, b) => {
      if (sortMode === 'date_desc') return (b.created_at ?? '').localeCompare(a.created_at ?? '');
      if (sortMode === 'date_asc')  return (a.created_at ?? '').localeCompare(b.created_at ?? '');
      if (sortMode === 'principal_desc') return b.principal - a.principal;
      return a.principal - b.principal;
    });

    return rows;
  }, [allRows, period, search, filterArrears, sortMode]);

  const visibleRows = filtered.filter(r => !hidden.has(String(r.loan_id)));
  const displayRows = flagged.size > 0 ? visibleRows.filter(r => flagged.has(String(r.loan_id))) : visibleRows;

  const totals = displayRows.reduce(
    (acc, r) => ({ p: acc.p + r.principal, i: acc.i + r.interest, f: acc.f + r.fees, a: acc.a + r.arrears }),
    { p: 0, i: 0, f: 0, a: 0 }
  );

  const totalPrincipal = allRows.reduce((s, r) => s + r.principal, 0);
  const totalInterest  = allRows.reduce((s, r) => s + r.interest, 0);
  const totalArrears   = allRows.reduce((s, r) => s + r.arrears, 0);
  const arrearCount    = allRows.filter(r => r.arrears > 0).length;

  function toggleHide(id: string) {
    setHidden(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleFlag(id: string) {
    setFlagged(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function resetView() { setHidden(new Set()); setFlagged(new Set()); }

  const nextSort = () => setSortMode(prev => SORT_CYCLE[(SORT_CYCLE.indexOf(prev) + 1) % SORT_CYCLE.length]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'current_month', label: '1M' },
    { key: 'last_3_months', label: '3M' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'ALL' },
  ];

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          body { background: white !important; }
          nav, aside, header, .sidebar, .print-hidden { display: none !important; }
          .admin-table-wrap { max-height: none !important; overflow: visible !important; }
          table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; }
          th, td { border: 1px solid #e5e7eb !important; padding: 6px !important; }
          .print-header { display: flex !important; }
        }
        .print-header { display: none; }
      `}</style>

      {/* Print-only header — hidden on screen, visible when printing */}
      <div className="print-header" style={{ justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1f2937', paddingBottom: 16, marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>AlgoLend</h1>
          <p style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, margin: '4px 0 0' }}>Revenue Analytics Report</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }}>Generated: {new Date().toLocaleDateString('en-ZA')}</p>
        </div>
      </div>

      {/* Header */}
      <PageHeader
        title="Revenue Analytics"
        subtitle="Portfolio Revenue &amp; Amortisation Statement"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Period tabs */}
            <div className="dash-tab-group">
              {PERIODS.map(p => (
                <button
                  key={p.key}
                  className={`dash-tab-btn${period === p.key ? ' active' : ''}`}
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Export */}
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-primary"
                onClick={() => setShowExport(o => !o)}
                onBlur={() => setTimeout(() => setShowExport(false), 150)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>file_export</span>
                Export
                <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: 0.7 }}>expand_more</span>
              </button>
              {showExport && (
                <div style={{
                  position: 'absolute', right: 0, top: '110%', background: '#fff',
                  border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                  zIndex: 50, overflow: 'hidden', minWidth: 180,
                }}>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', width: '100%', fontSize: 13, borderBottom: '1px solid #f1f5f9', background: 'none', cursor: 'pointer' }}
                    onClick={() => { window.print(); setShowExport(false); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#EF4444' }}>picture_as_pdf</span>
                    Save as PDF
                  </button>
                  <button
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', width: '100%', fontSize: 13, background: 'none', cursor: 'pointer' }}
                    onClick={() => { exportCsv(filtered); setShowExport(false); }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#10B981' }}>table_chart</span>
                    Download CSV
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {/* KPI row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        <div className="stat-card">
          <span className="stat-label">Total Loans</span>
          <div className="stat-value">{allRows.length}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Principal</span>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalPrincipal)}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Projected Interest</span>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalInterest)}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Arrears Exposure</span>
          <div className="stat-value" style={{ fontSize: 18, color: totalArrears > 0 ? '#EF4444' : 'inherit' }}>
            {fmt(totalArrears)}
            {arrearCount > 0 && <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 4 }}>({arrearCount})</span>}
          </div>
        </div>
      </div>

      {/* Search / Filter / Sort bar */}
      <div className="chart-card" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="admin-search" style={{ flex: '1 1 260px', minWidth: 200 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-text-muted)" }}>search</span>
          <input
            type="text"
            placeholder="Search customer or loan ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {(hidden.size > 0 || flagged.size > 0) && (
          <button
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', background: 'rgba(124,58,237,0.06)', border: 'none', borderRadius: 10, cursor: 'pointer' }}
            onClick={resetView}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
            Reset View
          </button>
        )}
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: filterArrears ? '#FEF2F2' : '#fff', color: filterArrears ? '#DC2626' : 'var(--color-text-muted)', cursor: 'pointer' }}
          onClick={() => setFilterArrears(f => !f)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_list</span>
          {filterArrears ? 'Filter: Arrears Only' : 'Filter: All'}
        </button>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', color: 'var(--color-text-muted)', cursor: 'pointer' }}
          onClick={nextSort}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>sort</span>
          Sort: {SORT_LABELS[sortMode]}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <SkeletonLoader type="table" />
        </div>
      ) : (
        <div className="admin-table-wrap" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <table className="admin-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th>Loan ID</th>
                <th>Customer</th>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Principal</th>
                <th style={{ textAlign: 'right' }}>Interest</th>
                <th style={{ textAlign: 'right' }}>Fees</th>
                <th style={{ textAlign: 'right' }}>Arrears</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Sticky totals row */}
              {displayRows.length > 0 && (
                <tr style={{ background: '#f8fafc', fontWeight: 700, borderBottom: '2px solid #e2e8f0' }}>
                  <td style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: flagged.size > 0 ? '#D97706' : '#1e293b' }}>
                    {flagged.size > 0 ? 'Highlighted Totals' : 'Visible Totals'}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{displayRows.length} items</td>
                  <td />
                  <td style={{ textAlign: 'right' }}>{fmt(totals.p)}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(totals.i)}</td>
                  <td style={{ textAlign: 'right', color: '#3B82F6' }}>{fmt(totals.f)}</td>
                  <td style={{ textAlign: 'right', color: '#EF4444' }}>{fmt(totals.a)}</td>
                  <td />
                </tr>
              )}

              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState icon="bar_chart" title="No records found" />
                  </td>
                </tr>
              ) : filtered.map(row => {
                const id = String(row.loan_id);
                const isHidden = hidden.has(id);
                const isFlagged = flagged.has(id);
                const rowStyle: React.CSSProperties = isHidden
                  ? { opacity: 0.35, filter: 'grayscale(1)', background: '#f8fafc' }
                  : isFlagged
                  ? { background: '#FFFBEB', borderLeft: '3px solid #F59E0B' }
                  : {};
                return (
                  <tr key={id} style={rowStyle}>
                    <td style={{ fontWeight: 600 }}>{row.loan_id}</td>
                    <td style={{ fontWeight: 500 }}>{row.customer}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{row.month}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(row.principal)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{fmt(row.interest)}</td>
                    <td style={{ textAlign: 'right', color: '#3B82F6', fontWeight: 500 }}>{fmt(row.fees)}</td>
                    <td style={{ textAlign: 'right', fontWeight: row.arrears > 0 ? 700 : 400, color: row.arrears > 0 ? '#EF4444' : 'var(--color-text-muted)' }}>
                      {fmt(row.arrears)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <button
                          className="admin-icon-btn"
                          title={isHidden ? 'Show row' : 'Hide row'}
                          onClick={() => toggleHide(id)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: isHidden ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                            {isHidden ? 'visibility' : 'visibility_off'}
                          </span>
                        </button>
                        <button
                          className="admin-icon-btn"
                          title={isFlagged ? 'Unflag row' : 'Flag row'}
                          onClick={() => toggleFlag(id)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: isFlagged ? '#F59E0B' : 'var(--color-text-muted)' }}>
                            {isFlagged ? 'flag' : 'outlined_flag'}
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
