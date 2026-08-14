import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

type Range = '1M' | '3M' | '6M' | 'YTD';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

const safeNum = (val: number | undefined | null) =>
  val === undefined || val === null || isNaN(Number(val)) ? 0 : Number(val);

// ── Mock data per range ──────────────────────────────────────────────────────

interface FinancialsData {
  incomeStatement: {
    interestIncome: number;
    nii: number;
    feeIncome: number;
    nir: number;
    totalRevenue: number;
  };
  ratios: {
    clr: string;
    niiToRevenue: number;
    nirToRevenue: number;
  };
  balanceSheet: {
    totalLoanBook: number;
    activeClients: number;
    arrearsPercentage: number;
  };
}

const MOCK_DATA: Record<Range, FinancialsData> = {
  '1M': {
    incomeStatement: { interestIncome: 285_000, nii: 241_250, feeIncome: 42_000, nir: 38_000, totalRevenue: 279_250 },
    ratios:          { clr: '2.3%', niiToRevenue: 86.4, nirToRevenue: 13.6 },
    balanceSheet:    { totalLoanBook: 3_850_000, activeClients: 412, arrearsPercentage: 4.2 },
  },
  '3M': {
    incomeStatement: { interestIncome: 840_000, nii: 712_000, feeIncome: 126_000, nir: 114_000, totalRevenue: 826_000 },
    ratios:          { clr: '2.8%', niiToRevenue: 86.2, nirToRevenue: 13.8 },
    balanceSheet:    { totalLoanBook: 4_120_000, activeClients: 438, arrearsPercentage: 5.1 },
  },
  '6M': {
    incomeStatement: { interestIncome: 1_640_000, nii: 1_390_000, feeIncome: 246_000, nir: 221_000, totalRevenue: 1_611_000 },
    ratios:          { clr: '3.1%', niiToRevenue: 86.3, nirToRevenue: 13.7 },
    balanceSheet:    { totalLoanBook: 4_450_000, activeClients: 461, arrearsPercentage: 5.8 },
  },
  'YTD': {
    incomeStatement: { interestIncome: 3_280_000, nii: 2_780_000, feeIncome: 492_000, nir: 442_000, totalRevenue: 3_222_000 },
    ratios:          { clr: '3.4%', niiToRevenue: 86.3, nirToRevenue: 13.7 },
    balanceSheet:    { totalLoanBook: 4_720_000, activeClients: 487, arrearsPercentage: 6.2 },
  },
};

// ── CSV export ───────────────────────────────────────────────────────────────

function exportFinancialsCSV(range: Range) {
  const d = MOCK_DATA[range];
  const rows = [
    ['Section', 'Item', 'Value'],
    ['INCOME', 'Interest Income', fmt(d.incomeStatement.interestIncome)],
    ['INCOME', 'Net Interest Income (NII)', fmt(d.incomeStatement.nii)],
    ['INCOME', 'Non-Interest Revenue (NIR)', fmt(d.incomeStatement.nir + d.incomeStatement.feeIncome)],
    ['INCOME', 'Total Revenue', fmt(d.incomeStatement.totalRevenue)],
    ['RATIOS', 'Credit Loss Ratio (CLR)', d.ratios.clr],
    ['RATIOS', 'NII % of Total Revenue', d.ratios.niiToRevenue.toFixed(1) + '%'],
    ['RATIOS', 'NIR % of Total Revenue', d.ratios.nirToRevenue.toFixed(1) + '%'],
    ['BALANCE', 'Total Loan Book Value', fmt(d.balanceSheet.totalLoanBook)],
    ['BALANCE', 'Total Active Clients', String(d.balanceSheet.activeClients)],
    ['BALANCE', 'Arrears Rate', d.balanceSheet.arrearsPercentage.toFixed(1) + '%'],
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })),
    download: `algolend_financials_${range}.csv`,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Table row component ──────────────────────────────────────────────────────

interface TableRowProps {
  label: string;
  value: string;
  bold?: boolean;
  total?: boolean;
  danger?: boolean;
}

function FinRow({ label, value, bold, total, danger }: TableRowProps) {
  return (
    <tr style={{
      borderBottom: total ? undefined : '1px solid #f3f4f6',
      borderTop: total ? '2px solid #e5e7eb' : undefined,
      background: total ? '#f9fafb' : undefined,
      transition: 'background 0.12s',
    }}
      onMouseOver={e => { if (!total) (e.currentTarget as HTMLElement).style.background = '#f9fafb'; }}
      onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = total ? '#f9fafb' : ''; }}>
      <td style={{
        padding: '14px 32px',
        fontSize: total ? 11 : 14,
        fontWeight: total ? 800 : bold ? 700 : 400,
        color: '#374151',
        textTransform: total ? 'uppercase' as const : undefined,
        letterSpacing: total ? '0.05em' : undefined,
      }}>
        {label}
      </td>
      <td style={{
        padding: '14px 32px',
        textAlign: 'right',
        fontFamily: 'monospace',
        fontSize: total ? 17 : 14,
        fontWeight: total ? 700 : bold ? 700 : 400,
        color: danger ? '#dc2626' : total ? '#111827' : '#1f2937',
      }}>
        {value}
      </td>
    </tr>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

const TABS: Range[] = ['1M', '3M', '6M', 'YTD'];

export function FinancialsPage() {
  const [range, setRange] = useState<Range>('YTD');
  const [showExport, setShowExport] = useState(false);

  const { data, isLoading } = useQuery<FinancialsData>({
    queryKey: ['admin-financials', range],
    queryFn: () => Promise.resolve(MOCK_DATA[range]),
    staleTime: 60_000,
  });

  const d = data ?? MOCK_DATA[range];
  const { incomeStatement, ratios, balanceSheet } = d;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 900, animation: 'fadeIn 0.3s ease' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: 24,
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.5px' }}>
            AlgoLend
          </h1>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-muted)', marginTop: 4 }}>
            Financial Reports &amp; Performance Metrics
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Branch filter */}
          <select style={{
            fontSize: 12,
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '8px 14px',
            fontWeight: 600,
            color: 'var(--color-text)',
            background: '#fff',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}>
            <option value="all">All Branches</option>
          </select>

          {/* Time range tabs */}
          <div style={{ background: 'var(--color-surface-muted)', padding: 4, borderRadius: 12, display: 'flex', gap: 2 }}>
            {TABS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setRange(t)}
                style={{
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  background: range === t ? '#fff' : 'transparent',
                  color: range === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  boxShadow: range === t ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                }}>
                {t}
              </button>
            ))}
          </div>

          {/* Export dropdown */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setShowExport(true)}
            onMouseLeave={() => setShowExport(false)}>
            <button
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 18px',
                borderRadius: 12,
                background: 'var(--color-primary)',
                color: '#fff',
                fontWeight: 700,
                fontSize: 13,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>file_export</span>
              Export
              <span className="material-symbols-outlined" style={{ fontSize: 13, opacity: 0.7 }}>expand_more</span>
            </button>

            {showExport && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: 6,
                width: 210,
                background: '#fff',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
                zIndex: 50,
                overflow: 'hidden',
              }}>
                <button
                  type="button"
                  onClick={() => { window.print(); setShowExport(false); }}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 16px', fontSize: 13, border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(0,0,0,0.05)', fontFamily: 'inherit' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseOut={e => (e.currentTarget.style.background = '#fff')}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#dc2626' }}>picture_as_pdf</span>
                  Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => { exportFinancialsCSV(range); setShowExport(false); }}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 16px', fontSize: 13, border: 'none', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'inherit' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseOut={e => (e.currentTarget.style.background = '#fff')}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#16a34a' }}>table_chart</span>
                  Download CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Report content ── */}
      {isLoading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-muted)', opacity: 0.6 }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          Loading financial data…
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, transition: 'opacity 0.3s' }}>

          {/* Income Statement */}
          <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '20px 32px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'var(--color-surface-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Income Statement</h3>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: 6 }}>
                {range} Performance
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <FinRow label="Interest Income"                              value={fmt(safeNum(incomeStatement.interestIncome))} />
                <FinRow label="Net Interest Income (NII)"                    value={fmt(safeNum(incomeStatement.nii))} bold />
                <FinRow label="Non-Interest Revenue (NIR)"                   value={fmt(safeNum(incomeStatement.nir + incomeStatement.feeIncome))} />
                <FinRow label="Total Revenue"                                value={fmt(safeNum(incomeStatement.totalRevenue))} total />
              </tbody>
            </table>
          </div>

          {/* Key Ratios */}
          <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '20px 32px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'var(--color-surface-muted)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Key Ratios</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <FinRow label="Credit Loss Ratio (CLR)"        value={ratios.clr}                                    danger />
                <FinRow label="NII % of Total Revenue"          value={safeNum(ratios.niiToRevenue).toFixed(1) + '%'} />
                <FinRow label="NIR % of Total Revenue"          value={safeNum(ratios.nirToRevenue).toFixed(1) + '%'} />
              </tbody>
            </table>
          </div>

          {/* Balance Sheet Snapshot */}
          <div className="glass-card" style={{ borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '20px 32px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'var(--color-surface-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Balance Sheet Snapshot</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <FinRow label="Total Loan Book Value"    value={fmt(safeNum(balanceSheet.totalLoanBook))} bold />
                <FinRow label="Total Active Clients"     value={String(safeNum(balanceSheet.activeClients))} />
                <FinRow label="Arrears Rate"             value={safeNum(balanceSheet.arrearsPercentage).toFixed(1) + '%'} danger />
              </tbody>
            </table>
          </div>

        </div>
      )}
    </div>
  );
}
