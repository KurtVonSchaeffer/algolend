import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchConsumers,
  fetchNcrReportingData,
  fetchNcrRegisters,
  fetchComplianceTasks,
  upsertComplianceTask,
  fetchGoAMLReports,
  createGoAMLReport,
  fetchPayouts,
  fetchLoans,
  fetchSacrraMembers,
  fetchSacrraSubmissions,
  fetchSacrraRejections,
  updateSacrraProfile,
  resolveSacrraRejection,
} from '../services/adminData';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonLoader } from '../components/ui/SkeletonLoader';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBadge } from '../components/ui/StatusBadge';

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getInitials(name: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function AvatarCircle({ name }: { name: string }) {
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: 'rgba(124,58,237,0.12)', color: 'var(--color-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 12, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <div className="stat-value" style={{ color, fontSize: typeof value === 'string' && value.length > 6 ? 16 : undefined }}>
        {value}
      </div>
    </div>
  );
}

function exportCsv(rows: any[], columns: { key: string; label: string }[], filename: string) {
  const headers = columns.map(c => c.label);
  const lines = rows.map(r => columns.map(c => {
    const val = c.key.split('.').reduce((o: any, k) => o?.[k], r) ?? '';
    return `"${String(val).replace(/"/g, '""')}"`;
  }).join(','));
  const blob = new Blob(['﻿' + [headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ─── SACRRA ──────────────────────────────────────────────────────────────────

export function SACRRAPage() {
  type SacrraTab = 'dashboard' | 'submissions' | 'bureaux' | 'rejections';
  const [tab, setTab] = useState<SacrraTab>('dashboard');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportType, setExportType] = useState<'MONTHLY' | 'DAILY'>('MONTHLY');
  const [exportPrefix, setExportPrefix] = useState<'R' | 'C' | 'D'>('D');
  const [exportMonth, setExportMonth] = useState('');
  const [bureaux, setBureaux] = useState<any[]>([]);
  const [bureauLoading, setBureauLoading] = useState(false);
  const [bureauError, setBureauError] = useState<string | null>(null);
  const [surgicalMember, setSurgicalMember] = useState<any>(null);
  const [savingFix, setSavingFix] = useState(false);
  const [fixValues, setFixValues] = useState({ address: '', employer: '', occupation: '', id: '', middle: '' });

  const ringRef = useRef<SVGCircleElement>(null);
  const scoreElRef = useRef<HTMLSpanElement>(null);
  const totalElRef = useRef<HTMLHeadingElement>(null);
  const cleanElRef = useRef<HTMLDivElement>(null);
  const splitBarRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const membersQ = useQuery({ queryKey: ['sacrra-members'], queryFn: fetchSacrraMembers, staleTime: 60_000 });
  const submissionsQ = useQuery({ queryKey: ['sacrra-submissions'], queryFn: fetchSacrraSubmissions, staleTime: 60_000 });
  const rejectionsQ = useQuery({ queryKey: ['sacrra-rejections'], queryFn: fetchSacrraRejections, staleTime: 60_000 });

  const members: any[] = membersQ.data?.data ?? [];
  const submissions: any[] = submissionsQ.data?.data ?? [];
  const rejections: any[] = rejectionsQ.data?.data ?? [];

  const validSAID = (id: string) => {
    if (!id || id.trim().length !== 13) return false;
    let n = 0, even = false;
    for (let i = id.trim().length - 1; i >= 0; i--) {
      let d = parseInt(id.trim()[i], 10);
      if (even && (d *= 2) > 9) d -= 9;
      n += d; even = !even;
    }
    return n % 10 === 0;
  };

  const VALID_STATUS_CODES = new Set(['C','D','E','I','J','L','P','T','V','W','Z']);

  const issueMembers = useMemo(() => members.map(m => {
    const issues: string[] = [];
    if (!validSAID(m.f10_id_number)) issues.push('ID_LUHN_FAIL');
    if (!m.f10_id_number?.trim()) issues.push('EMPTY_IDENTITY');
    if (!m.f06_surname?.trim()) issues.push('MISSING_SURNAME');
    if (!m.f07_first_names?.trim()) issues.push('MISSING_FIRST_NAME');
    if (!m.f13_address_1?.trim()) issues.push('MISSING_ADDRESS');
    if (!m.f41_opening_balance || m.f41_opening_balance === '000000000000') issues.push('MISSING_OPENING_BALANCE');
    if (!m.f43_date_opened || m.f43_date_opened === '00000000') issues.push('MISSING_DATE_OPENED');
    const sc = (m.f50_status_code || '').trim();
    if (sc && !VALID_STATUS_CODES.has(sc)) issues.push(`INVALID_STATUS_CODE:${sc}`);
    const acct = (m.f40_account_number || '').trim();
    if (!acct) issues.push('MISSING_ACCOUNT_NUMBER');
    else if (/\s/.test(acct)) issues.push('ACCOUNT_NUMBER_HAS_SPACES');
    return { ...m, issues };
  }).filter(m => m.issues.length > 0), [members]);

  const total = members.length;
  const issueCount = issueMembers.length;
  const clean = total - issueCount;
  const scorePct = total > 0 ? Math.round((clean / total) * 100) : 100;
  const CIRC = 339.3;

  useEffect(() => {
    if (tab !== 'dashboard' || membersQ.isLoading) return;
    const dash = (scorePct / 100) * CIRC;
    const tid = setTimeout(() => {
      if (ringRef.current) ringRef.current.style.strokeDashoffset = String(CIRC - dash);
      if (splitBarRef.current) splitBarRef.current.style.width = (total > 0 ? (clean / total) * 100 : 100) + '%';
      const animCount = (el: HTMLElement | null, target: number, suffix = '') => {
        if (!el) return;
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / 1200, 1);
          const ease = 1 - Math.pow(1 - t, 4);
          el.textContent = Math.round(ease * target) + suffix;
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      };
      animCount(scoreElRef.current, scorePct, '%');
      animCount(totalElRef.current as HTMLElement, total);
      animCount(cleanElRef.current, clean);
    }, 60);
    return () => clearTimeout(tid);
  }, [tab, scorePct, total, clean, membersQ.isLoading]);

  useEffect(() => {
    if (tab !== 'bureaux') return;
    setBureauLoading(true); setBureauError(null);
    fetch('/api/sacrra/bureaux', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data, error }: any) => {
        if (error) throw new Error(error);
        setBureaux(data || []);
      })
      .catch((e: any) => setBureauError(e.message))
      .finally(() => setBureauLoading(false));
  }, [tab]);

  const saveBureau = async (key: string) => {
    const srnEl = document.getElementById(`srn-${key}`) as HTMLInputElement | null;
    const methodEl = document.getElementById(`method-${key}`) as HTMLSelectElement | null;
    const emailEl = document.getElementById(`email-${key}`) as HTMLInputElement | null;
    const pgpEl = document.getElementById(`pgp-${key}`) as HTMLTextAreaElement | null;
    const payload: any = {
      supplier_ref_number: srnEl?.value.trim() || null,
      submission_method: methodEl?.value || 'email',
      submission_email: emailEl?.value.trim() || null,
    };
    const pgpVal = pgpEl?.value.trim() || '';
    if (pgpVal.startsWith('-----')) payload.pgp_public_key = pgpVal;
    const res = await fetch(`/api/sacrra/bureaux/${key}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const { success, error } = await res.json();
    if (success) { setTab('submissions'); setTimeout(() => setTab('bureaux'), 10); }
    else alert('Save failed: ' + error);
  };

  const resolveRejection = async (id: number) => {
    if (!confirm('Mark this rejection as resolved?')) return;
    await resolveSacrraRejection(id);
    qc.invalidateQueries({ queryKey: ['sacrra-rejections'] });
  };

  const processBureauFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const newRejections: any[] = [];
      for (const line of content.split('\n')) {
        if (line.startsWith('R') || line.startsWith('E')) {
          const matchKey = line.substring(1, 41).trim();
          const errorCode = line.substring(41, 45).trim();
          const errorMessage = line.substring(45, 100).trim();
          if (matchKey && errorCode) newRejections.push({ match_key: matchKey, error_code: errorCode, error_message: errorMessage });
        }
      }
      alert(newRejections.length > 0 ? `Parsed ${newRejections.length} rejection${newRejections.length !== 1 ? 's' : ''}.` : 'No rejection codes found in file.');
      if (newRejections.length > 0) qc.invalidateQueries({ queryKey: ['sacrra-rejections'] });
    };
    reader.readAsText(file);
  };

  const buildSacrraFileContent = () => {
    const aL = (val: any, len: number) => String(val || '').replace(/\r?\n/g, '').slice(0, len).padEnd(len, ' ');
    const nR = (val: any, len: number) => { const n = String(val || '').replace(/[^0-9]/g, '') || '0'; return n.slice(-len).padStart(len, '0'); };
    const dt = (val: any) => String(val || '00000000').replace(/-/g, '').slice(0, 8).padStart(8, '0');
    let reportingDate: Date;
    if (exportMonth?.length === 7) { const [yr, mo] = exportMonth.split('-').map(Number); reportingDate = new Date(yr, mo, 0); }
    else reportingDate = new Date();
    const lastDay = new Date(reportingDate.getFullYear(), reportingDate.getMonth() + 1, 0);
    const monthEnd = dt(lastDay.toISOString().slice(0, 10).replace(/-/g, ''));
    const creationDate = dt(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    const srnRaw = (members[0]?.f02_supplier_ref || '').trim();
    const srn = srnRaw.padStart(10, ' ').slice(-10);
    const tradingName = aL('ALGOLEND', 60);
    let content = ('H' + srn + monthEnd + '06' + creationDate + tradingName).padEnd(700, ' ').slice(0, 700) + '\r\n';
    const STATUS_DATE_CAP = new Set(['B','C','D','G','H','K','M','P','S','T','V','X','Z']);
    const LASTPAY_CAP = new Set(['','E','I','L','J','W','Y']);
    const branchCode = aL((members[0]?.f02b_branch_code || '').trim(), 8);
    const toInt8 = (s: string) => parseInt((s || '').replace(/\D/g, '').slice(0, 8) || '0') || 0;
    const monthEndInt = toInt8(monthEnd);
    members.forEach(m => {
      const recordType = exportType === 'DAILY' ? exportPrefix : 'D';
      const accountType = aL(m.f03_account_type || 'P', 2);
      const rawStatus = (m.f50_status_code || '').trim();
      const isPositive = ['C','T','V','P'].includes(rawStatus);
      const saId = (m.f10_id_number || '').replace(/\D/g, '').padStart(13, '0').slice(0, 13);
      const ownerTenant = (m.f13_address_1 || '').trim() ? 'O' : 'T';
      const rawDateOpened = (m.f43_date_opened || '').replace(/-/g, '').slice(0, 8) || '0';
      const dateOpenedInt = toInt8(rawDateOpened);
      let statusDateStr = (m.f51_status_date || '').replace(/-/g, '').slice(0, 8) || '0';
      if (!rawStatus) statusDateStr = '0';
      else if (STATUS_DATE_CAP.has(rawStatus) && toInt8(statusDateStr) > monthEndInt) statusDateStr = monthEnd;
      let lastPayStr = (m.f46_last_payment_date || '').replace(/-/g, '').slice(0, 8) || '0';
      if (LASTPAY_CAP.has(rawStatus) && toInt8(lastPayStr) > monthEndInt) lastPayStr = monthEnd;
      if (toInt8(lastPayStr) > 0 && dateOpenedInt > 0 && toInt8(lastPayStr) < dateOpenedInt) lastPayStr = '0';
      const openBal = nR(isPositive ? 0 : (m.f41_opening_balance || '0').replace(/\D/g, ''), 9);
      const currBal = nR(isPositive ? 0 : (m.f44_current_balance || '0').replace(/\D/g, ''), 9);
      const instalment = nR(isPositive ? 0 : (m.f45_installment || '0').replace(/\D/g, ''), 9);
      const rawOverdue = isPositive ? 0 : parseInt((m.f49_arrears_amount || '0').replace(/\D/g, '')) || 0;
      const openYear = dateOpenedInt ? Math.floor(dateOpenedInt / 10000) : 0;
      const openMonth2 = dateOpenedInt ? Math.floor((dateOpenedInt % 10000) / 100) : 0;
      const endYear = Math.floor(monthEndInt / 10000);
      const endMonth2 = Math.floor((monthEndInt % 10000) / 100);
      const ageMonths = openYear ? Math.max(0, (endYear - openYear) * 12 + (endMonth2 - openMonth2)) : 999;
      let mthsArrInt = isPositive ? 0 : Math.min(parseInt(m.f53_months_in_arrears || '0') || 0, ageMonths);
      let finalOverdue = rawOverdue;
      if (mthsArrInt === 0) finalOverdue = 0; else if (finalOverdue === 0) mthsArrInt = 0;
      const cleanSurname = (m.f06_surname || '').replace(/\s*(PTY\.?\s*LTD\.?|LTD\.?|\bCC\b|INC\.?|\(PTY\)|BK|NPC|RF)\s*$/i, '').replace(/\s*&.*$/, '').trim();
      const cleanForename = (m.f07_first_names || '').replace(/[^A-Za-z\-`' ]/g, '').trim();
      const title = ((m.f11_gender || '').toUpperCase().trim() === 'F') ? 'MS' : 'MR';
      const termsVal = (accountType.trim() === 'M') ? '0' : (m.f42_terms || m.term_months || '1');
      let r = '';
      r += aL(recordType, 1); r += saId; r += aL('', 16); r += aL(m.f11_gender || 'M', 1);
      r += nR((m.f12_date_of_birth || '').replace(/-/g, '') || '0', 8); r += branchCode;
      r += (m.f40_account_number || m.internal_id || '').trim().padStart(25, ' '); r += aL('', 4);
      r += aL(cleanSurname, 25); r += aL(title, 5); r += aL(cleanForename, 14);
      r += aL('', 14); r += aL('', 14);
      r += aL(m.f13_address_1 || '', 25); r += aL(m.f14_address_2 || '', 25);
      r += aL(m.f15_city || '', 25); r += aL(m.f16_province || '', 25); r += aL(m.f17_postal || '', 6);
      r += aL(ownerTenant, 1); r += aL('', 25); r += aL('', 25); r += aL('', 25); r += aL('', 25); r += aL('', 6);
      r += aL('00', 2); r += aL((m.f30_loan_reason || '').trim() || 'O', 2); r += aL('00', 2);
      r += aL(accountType, 2); r += nR(rawDateOpened || '0', 8); r += nR('0', 8);
      r += nR(lastPayStr || '0', 8); r += openBal; r += currBal; r += aL('D', 1);
      r += nR(finalOverdue, 9); r += instalment; r += String(mthsArrInt).padStart(2, '0');
      r += aL(rawStatus || '  ', 2); r += nR(m.f54_repayment_frequency || '03', 2);
      r += nR(termsVal, 4); r += nR(statusDateStr || '0', 8);
      r += aL('', 8); r += aL('', 25); r += aL('', 4); r += aL('', 10);
      r += aL('', 16); r += aL(m.f31_mobile || '', 16); r += aL(m.f32_work || '', 16);
      r += aL(m.f35_employer || '', 60); r += nR('0', 9); r += aL('M', 1);
      r += aL('', 20); r += aL('', 60); r += nR('0', 2); r += nR('0', 3); r += aL('', 2);
      content += r.padEnd(700, ' ').slice(0, 700) + '\r\n';
    });
    content += ('T' + String(members.length + 2).padStart(9, '0')).padEnd(700, ' ').slice(0, 700) + '\r\n';
    return content;
  };

  const handleExport = () => {
    if (members.length === 0) { alert('No data found.'); return; }
    if (!exportMonth) {
      const now = new Date();
      const def = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (!confirm(`No reporting period selected.\n\nThe header will use current month-end (${def}).\n\nContinue?`)) return;
    }
    const content = buildSacrraFileContent();
    const srnForFile = (members[0]?.f02_supplier_ref || '').trim();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const typeChar = exportType === 'MONTHLY' ? 'M' : 'D';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${srnForFile}_ALL_T702_${typeChar}_${dateStr}_1_1.txt`;
    a.click();
    setExportOpen(false);
  };

  const openSurgicalFix = (m: any) => {
    setSurgicalMember(m);
    setFixValues({ address: m.f13_address_1?.trim() || '', employer: m.f35_employer?.trim() || '', occupation: m.f36_occupation?.trim() || '', id: m.f10_id_number?.trim() || '', middle: m.f09_middle_names?.trim() || '' });
  };

  const saveSurgicalFix = async () => {
    if (!surgicalMember) return;
    setSavingFix(true);
    try {
      await updateSacrraProfile(surgicalMember.internal_id, { address_line_1: fixValues.address, employer_name: fixValues.employer, occupation: fixValues.occupation, id_number: fixValues.id, middle_name: fixValues.middle });
      setSurgicalMember(null);
      qc.invalidateQueries({ queryKey: ['sacrra-members'] });
    } catch { alert('Failed to save correction.'); }
    finally { setSavingFix(false); }
  };

  const P = 'var(--color-primary)';
  const TABS = [
    { id: 'dashboard' as const, icon: 'dashboard', label: 'Dashboard' },
    { id: 'submissions' as const, icon: 'account_tree', label: 'Submissions' },
    { id: 'bureaux' as const, icon: 'verified', label: 'Bureaux' },
    { id: 'rejections' as const, icon: 'error', label: 'Rejections' },
  ];

  return (
    <>
      <PageHeader
        title="SACRRA"
        subtitle="Credit bureau submission · Layout 700v2 Compliance Engine"
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/admin-panel/sacrra-validator" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 13, fontWeight: 700, color: 'var(--color-text)', textDecoration: 'none', background: 'var(--color-surface-card)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: P }}>rule_folder</span>
              Migration Validator
            </a>
            <button className="btn btn-primary" onClick={() => setExportOpen(true)}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>ios_share</span>
              Generate Compliance File
            </button>
          </div>
        }
      />

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--color-surface-card)', padding: 4, borderRadius: 14, border: '1px solid var(--color-border)', width: 'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: tab === t.id ? P : 'transparent', color: tab === t.id ? '#fff' : 'var(--color-text-muted)', transition: 'all 0.15s ease' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab === 'dashboard' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
            {/* Score ring */}
            <div style={{ background: `linear-gradient(135deg, ${P} 0%, #4c1d95 100%)`, padding: 28, borderRadius: 28, position: 'relative', overflow: 'hidden', color: '#fff' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, marginBottom: 20 }}>Compliance Score</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
                  <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10"/>
                    <circle ref={ringRef} cx="60" cy="60" r="54" fill="none" stroke="white" strokeWidth="10" strokeLinecap="round" strokeDasharray={String(CIRC)} strokeDashoffset={String(CIRC)} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)' }} />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span ref={scoreElRef} style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>0%</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Clean records</div>
                  <div ref={cleanElRef} style={{ fontSize: 36, fontWeight: 900, color: '#fff' }}>0</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 6 }}>{issueCount} issue{issueCount !== 1 ? 's' : ''} detected</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 700, marginTop: 10 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified</span>
                    Layout 700v2 · v2.8
                  </div>
                </div>
              </div>
            </div>
            {/* Bureau health */}
            <div className="admin-z-card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, background: 'rgba(124,58,237,0.1)', color: P, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="material-symbols-outlined">account_balance</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)' }}>Bureau Health</span>
              </div>
              {[{ name: 'Experian', pct: scorePct, verified: true }, { name: 'TransUnion', pct: 0, verified: false }, { name: 'XDS', pct: 0, verified: false }].map((b, i) => (
                <div key={b.name} style={{ marginBottom: i < 2 ? 16 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>{b.name}</span>
                    <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: b.verified ? '#10b981' : 'var(--color-text-muted)' }}>{b.verified ? 'VERIFIED' : 'PENDING'}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--color-surface-card)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${b.pct}%`, background: '#10b981', borderRadius: 10, transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)' }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Live records */}
            <div className="admin-z-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ width: 44, height: 44, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <span className="material-symbols-outlined">database</span>
                </div>
                <p style={{ color: 'var(--color-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: 10, marginBottom: 4 }}>Live Records</p>
                <h3 ref={totalElRef} style={{ fontSize: 44, fontWeight: 900, color: 'var(--color-text)', margin: 0 }}>0</h3>
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                  <span>Clean</span><span>Issues</span>
                </div>
                <div style={{ height: 12, background: 'var(--color-surface-card)', borderRadius: 99, overflow: 'hidden' }}>
                  <div ref={splitBarRef} style={{ height: '100%', width: '0%', background: '#10b981', borderRadius: 99, transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  <span>{clean}</span><span>{issueCount}</span>
                </div>
              </div>
            </div>
          </div>
          {/* Issue Workspace */}
          <div className="admin-z-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>Issue Workspace</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>High-priority records requiring institutional correction</p>
              </div>
            </div>
            {membersQ.isLoading ? <SkeletonLoader type="table" /> : issueMembers.length === 0 ? (
              <div style={{ padding: '60px 40px', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 36 }}>check_circle</span>
                </div>
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 6px' }}>Zero Integrity Issues</h4>
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>All records pass the Deep Compliance audit.</p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Record Member</th><th>Detected Issues</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
                  <tbody>
                    {issueMembers.map(m => (
                      <tr key={m.internal_id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{m.f07_first_names?.trim()} {m.f06_surname?.trim()}</div>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--color-text-muted)', marginTop: 2 }}>{m.f10_id_number || 'NO ID'}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {m.issues.map((issue: string) => (
                              <span key={issue} style={{ padding: '3px 10px', borderRadius: 99, fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: issue.includes('MISSING') ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)', color: issue.includes('MISSING') ? '#f97316' : '#ef4444' }}>
                                {issue.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button onClick={() => openSurgicalFix(m)} className="btn btn-secondary" style={{ fontSize: 11 }}>Surgical Fix</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SUBMISSIONS ── */}
      {tab === 'submissions' && (
        <div className="admin-z-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Submission Pipeline</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>Audit trail of bureau file transmissions</p>
            </div>
            <span style={{ padding: '4px 12px', background: 'var(--color-surface-card)', borderRadius: 99, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{submissions.length} Recent Files</span>
          </div>
          {submissionsQ.isLoading ? <SkeletonLoader type="table" /> : submissions.length === 0 ? <EmptyState icon="account_tree" title="No submissions yet" /> : (
            <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>File Name</th><th>Type</th><th>Records</th><th>Status</th><th style={{ textAlign: 'right' }}>Submitted At</th></tr></thead>
                  <tbody>
                    {submissions.map((s: any) => {
                      const dot = s.status === 'ACCEPTED' ? '#10b981' : s.status === 'REJECTED' ? '#ef4444' : '#f97316';
                      return (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.file_name}>{s.file_name}</td>
                          <td><span style={{ padding: '3px 10px', background: 'var(--color-surface-card)', borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase' }}>{s.submission_type}</span></td>
                          <td style={{ fontWeight: 800 }}>{s.record_count}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: dot }}>{s.status}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(s.created_at).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '16px 28px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-card)' }}>
                <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 10 }}>Upload Bureau Response File</p>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#fff', border: '2px dashed var(--color-border)', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>cloud_upload</span>
                  Select .TXT Response File from SACRRA/Experian
                  <input type="file" accept=".txt,.pgp,.csv" style={{ display: 'none' }} onChange={processBureauFile} />
                </label>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── BUREAUX ── */}
      {tab === 'bureaux' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Bureau Configuration</h2>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>Supplier Reference, PGP key, and submission method per bureau</p>
            </div>
          </div>
          {bureauLoading ? <SkeletonLoader type="table" /> : bureauError ? (
            <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, padding: 24, color: '#ef4444', fontSize: 13 }}>
              <strong>Could not load bureaux.</strong><br />{bureauError}<br /><br />
              <em>Run <code>sql/sacrra_bureaux.sql</code> in Supabase first.</em>
            </div>
          ) : bureaux.length === 0 ? <EmptyState icon="verified" title="No bureaux configured" /> : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {bureaux.map((b: any) => {
                const hasKey = !!b.pgp_public_key;
                const ready = hasKey && b.supplier_ref_number && (b.submission_email || b.submission_folder);
                return (
                  <div key={b.bureau_key} className="admin-z-card" style={{ padding: 24, borderColor: ready ? 'rgba(16,185,129,0.25)' : 'rgba(249,115,22,0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{b.bureau_name}</h3>
                          <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: ready ? 'rgba(16,185,129,0.1)' : 'rgba(249,115,22,0.1)', color: ready ? '#10b981' : '#f97316' }}>{ready ? 'Ready' : 'Setup needed'}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{b.bureau_key}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                      {[
                        { label: 'Supplier Reference Number', id: `srn-${b.bureau_key}`, value: b.supplier_ref_number || '', placeholder: 'e.g. ALG0001234', mono: true },
                        { label: 'Submission Email', id: `email-${b.bureau_key}`, value: b.submission_email || '', placeholder: `sacrra@${b.bureau_key}.co.za`, mono: false },
                      ].map(f => (
                        <div key={f.id}>
                          <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 6 }}>{f.label}</label>
                          <input id={f.id} defaultValue={f.value} placeholder={f.placeholder} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 13, fontFamily: f.mono ? 'monospace' : 'inherit', boxSizing: 'border-box' }} />
                        </div>
                      ))}
                      <div>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 6 }}>PGP Public Key</label>
                        <textarea id={`pgp-${b.bureau_key}`} rows={3} placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----..." defaultValue={hasKey && b.pgp_public_key?.includes('...') ? '' : (b.pgp_public_key || '')} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 11, fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical' }} />
                        <p style={{ fontSize: 10, margin: '4px 0 0', color: hasKey ? '#10b981' : '#f97316' }}>{hasKey ? '✓ Key configured' : 'No key — encryption will fail'}</p>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="btn btn-primary" onClick={() => saveBureau(b.bureau_key)}>Save</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── REJECTIONS ── */}
      {tab === 'rejections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-z-card" style={{ padding: 48, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <input type="file" accept=".txt,.pgp,.csv" onChange={processBureauFile} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} />
            <div style={{ width: 80, height: 80, background: 'rgba(124,58,237,0.1)', color: P, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 36 }}>upload_file</span>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>Rejection Parser</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 24px', maxWidth: 360, marginInline: 'auto' }}>Drop the .TXT file from the Bureau here to automatically map rejection codes.</p>
            <span className="btn btn-secondary" style={{ pointerEvents: 'none' }}>Select Bureau File</span>
          </div>
          <div className="admin-z-card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--color-border)' }}>
              <h4 style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: 0 }}>Active Bureau Rejections</h4>
            </div>
            {rejectionsQ.isLoading ? <SkeletonLoader type="table" /> : rejections.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)' }}>No active rejections found</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Match Key</th><th>Error Code</th><th>Message</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
                  <tbody>
                    {rejections.map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800 }}>{r.match_key}</td>
                        <td style={{ fontWeight: 800, color: '#ef4444', fontSize: 12 }}>{r.error_code}</td>
                        <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{r.error_message}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ fontSize: 11, color: '#10b981' }} onClick={() => resolveRejection(r.id)}>Resolve</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EXPORT MODAL ── */}
      {exportOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setExportOpen(false)}>
          <div style={{ background: '#fff', borderRadius: 40, padding: 40, width: '100%', maxWidth: 480, boxShadow: '0 32px 80px rgba(0,0,0,0.22)', transform: 'scale(1)', transition: 'transform 0.2s' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <h3 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: '#0f172a' }}>Export Parameters</h3>
              <button onClick={() => setExportOpen(false)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', marginBottom: 16 }}>Submission Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {(['MONTHLY', 'DAILY'] as const).map(t => (
                    <button key={t} onClick={() => setExportType(t)} style={{ padding: '24px 16px', borderRadius: 24, border: `2px solid ${exportType === t ? P : '#e2e8f0'}`, background: exportType === t ? 'rgba(124,58,237,0.05)' : '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 30, color: exportType === t ? P : '#94a3b8' }}>{t === 'MONTHLY' ? 'calendar_month' : 'timer'}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{t.charAt(0) + t.slice(1).toLowerCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', marginBottom: 12 }}>
                  Reporting Period <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' }}>(leave blank for current month)</span>
                </label>
                <input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 18, padding: '12px 16px', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', outline: 'none' }} />
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '6px 0 0' }}>Used for backdating submissions to correct prior-period data.</p>
              </div>
              {exportType === 'DAILY' && (
                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', marginBottom: 14 }}>Record Prefix</label>
                  <div style={{ display: 'flex', gap: 6, padding: 6, background: '#f8fafc', borderRadius: 18, border: '1px solid #e2e8f0' }}>
                    {(['R', 'C', 'D'] as const).map(p => (
                      <button key={p} onClick={() => setExportPrefix(p)} style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 11, background: exportPrefix === p ? '#fff' : 'transparent', color: exportPrefix === p ? P : '#94a3b8', boxShadow: exportPrefix === p ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                        {p} ({p === 'R' ? 'Registration' : p === 'C' ? 'Correction' : 'Data'})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 48 }}>
              <button onClick={() => setExportOpen(false)} style={{ flex: 1, padding: '16px 0', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 700, background: 'transparent', color: '#475569' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Cancel</button>
              <button onClick={handleExport} style={{ flex: 1, padding: '16px 0', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 900, background: P, color: '#fff', boxShadow: '0 8px 20px rgba(124,58,237,0.3)', transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>Download .TXT</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SURGICAL FIX MODAL ── */}
      {surgicalMember && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', padding: 24 }} onClick={() => setSurgicalMember(null)}>
          <div style={{ background: '#fff', borderRadius: 32, padding: 40, width: '100%', maxWidth: 600, boxShadow: '0 32px 80px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Surgical Correction</h2>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', margin: '6px 0 0' }}>Refining: {surgicalMember.f07_first_names?.trim()} {surgicalMember.f06_surname?.trim()}</p>
              </div>
              <button onClick={() => setSurgicalMember(null)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'var(--color-surface-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 8 }}>Full Residential Address</label>
                <input value={fixValues.address} onChange={e => setFixValues(v => ({ ...v, address: e.target.value }))} style={{ width: '100%', padding: '12px 16px', background: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: 14, fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }} placeholder="1 Main Street" />
              </div>
              {([['Employer Name','employer','Employer Inc.'],['Occupation','occupation','Clerk'],['ID Number','id','8501015009087'],['Middle Name','middle','']] as [string,keyof typeof fixValues,string][]).map(([label,key,ph]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-muted)', marginBottom: 8 }}>{label}</label>
                  <input value={fixValues[key]} onChange={e => setFixValues(v => ({ ...v, [key]: e.target.value }))} style={{ width: '100%', padding: '12px 16px', background: 'var(--color-surface-card)', border: '1px solid var(--color-border)', borderRadius: 14, fontSize: 14, fontWeight: 600, boxSizing: 'border-box' }} placeholder={ph} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button onClick={() => setSurgicalMember(null)} style={{ flex: 1, padding: '14px 0', borderRadius: 16, border: 'none', cursor: 'pointer', fontWeight: 700, background: 'var(--color-surface-card)', color: 'var(--color-text)' }}>Cancel</button>
              <button onClick={saveSurgicalFix} disabled={savingFix} className="btn btn-primary" style={{ flex: 1, padding: '14px 0', borderRadius: 16 }}>{savingFix ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── SACRRA Validator ────────────────────────────────────────────────────────
// ─── SACRRA Validator ────────────────────────────────────────────────────────

export function SACRRAValidatorPage() {
  const [ran, setRan] = useState(false);

  const loansQ = useQuery({ queryKey: ['admin-loans'], queryFn: () => fetchLoans(), staleTime: 60_000, enabled: ran });
  const consumersQ = useQuery({ queryKey: ['admin-consumers'], queryFn: fetchConsumers, staleTime: 60_000, enabled: ran });

  const loans = loansQ.data?.data ?? [];
  const consumers = consumersQ.data?.data ?? [];

  const checks = useMemo(() => {
    if (!ran) return [];
    const missingId = consumers.filter((c: any) => !c.id_number && !c.identity_number).length;
    const missingScore = consumers.filter((c: any) => !c.credit_score).length;
    const loansNoProfile = loans.filter((l: any) => !l.profiles?.full_name).length;
    const loansNoRate = loans.filter((l: any) => l.interest_rate == null).length;
    const orphanedLoans = loans.filter((l: any) => !l.user_id).length;

    return [
      { rule: 'Consumer ID numbers present', total: consumers.length, issues: missingId, pass: missingId === 0 },
      { rule: 'Credit scores populated', total: consumers.length, issues: missingScore, pass: missingScore === 0 },
      { rule: 'Loans linked to profiles', total: loans.length, issues: loansNoProfile, pass: loansNoProfile === 0 },
      { rule: 'Interest rates on all loans', total: loans.length, issues: loansNoRate, pass: loansNoRate === 0 },
      { rule: 'No orphaned loans (no user_id)', total: loans.length, issues: orphanedLoans, pass: orphanedLoans === 0 },
    ];
  }, [ran, consumers, loans]);

  const isLoading = loansQ.isLoading || consumersQ.isLoading;
  const passCount = checks.filter(c => c.pass).length;

  return (
    <>
      <PageHeader
        title="Migration Validator"
        subtitle="SACRRA data quality checks — run before submission"
        action={
          <button className="btn btn-primary" onClick={() => setRan(true)} disabled={isLoading}>
            {isLoading ? 'Running…' : 'Run Validation'}
          </button>
        }
      />

      {!ran ? (
        <div style={{ background: 'var(--color-surface-card)', border: '2px dashed var(--color-border)', borderRadius: 16, padding: '60px 40px', textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 56, color: 'var(--color-primary)', opacity: 0.4, display: 'block', marginBottom: 16 }}>rule_folder</span>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }}>Ready to validate</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>Click "Run Validation" to check data quality across consumers and loans.</p>
          <button className="btn btn-primary" onClick={() => setRan(true)}>Run Validation</button>
        </div>
      ) : isLoading ? (
        <SkeletonLoader type="table" />
      ) : (
        <>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
            <KpiCard label="Total Checks" value={checks.length} />
            <KpiCard label="Passed" value={passCount} color="#10B981" />
            <KpiCard label="Failed" value={checks.length - passCount} color={checks.length - passCount > 0 ? '#EF4444' : '#10B981'} />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Validation Rule</th><th>Records Checked</th><th>Issues Found</th><th>Result</th></tr>
              </thead>
              <tbody>
                {checks.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.rule}</td>
                    <td>{c.total}</td>
                    <td style={{ fontWeight: c.issues > 0 ? 700 : 400, color: c.issues > 0 ? '#EF4444' : 'inherit' }}>{c.issues}</td>
                    <td>
                      <StatusBadge status={c.pass ? 'PASS' : 'FAIL'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

// ─── NCR Reporting ───────────────────────────────────────────────────────────

export function NCRReportingPage() {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ncr-reporting'],
    queryFn: fetchNcrReportingData,
    staleTime: 60_000,
  });

  const submissions = data?.data ?? [];

  const filtered = useMemo(() => {
    return submissions.filter((s: any) => {
      const matchSearch = !search || (s.report_type ?? '').toLowerCase().includes(search.toLowerCase()) || (s.period ?? '').includes(search);
      const matchPeriod = period === 'ALL' || (s.period ?? '').startsWith(period);
      return matchSearch && matchPeriod;
    });
  }, [submissions, search, period]);

  const years = [...new Set(submissions.map((s: any) => (s.period ?? '').slice(0, 4)))].filter(Boolean).sort().reverse() as string[];

  return (
    <>
      <PageHeader
        title="NCR Reporting"
        subtitle="National Credit Regulator quarterly submissions"
        action={
          <button className="btn btn-secondary" onClick={() => exportCsv(filtered, [
            { key: 'period', label: 'Period' },
            { key: 'report_type', label: 'Type' },
            { key: 'status', label: 'Status' },
            { key: 'submitted_by', label: 'Submitted By' },
            { key: 'created_at', label: 'Date' },
          ], 'ncr_submissions.csv')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Export
          </button>
        }
      />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <KpiCard label="Total Submissions" value={submissions.length} />
        <KpiCard label="Approved" value={submissions.filter((s: any) => s.status === 'approved').length} color="#10B981" />
        <KpiCard label="Pending" value={submissions.filter((s: any) => s.status === 'pending').length} color="#F59E0B" />
        <KpiCard label="Rejected" value={submissions.filter((s: any) => s.status === 'rejected').length} color="#EF4444" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-text-muted)" }}>search</span>
          <input type="text" placeholder="Search by type or period…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="ALL">All Periods</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{filtered.length} submission{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <SkeletonLoader type="table" />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Period</th><th>Report Type</th><th>Submitted By</th><th>Reference</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6}><EmptyState icon="description" title="No NCR submissions found" /></td></tr>
                : filtered.map((s: any) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.period ?? '—'}</td>
                    <td>{s.report_type ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.submitted_by ?? '—'}</td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{s.reference ?? s.id?.slice(0, 8) ?? '—'}</td>
                    <td>
                      <StatusBadge status={s.status ?? 'pending'} />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(s.created_at).toLocaleDateString('en-ZA')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── NCR Registers ───────────────────────────────────────────────────────────

export function NCRRegistersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-ncr-registers'],
    queryFn: fetchNcrRegisters,
    staleTime: 60_000,
  });

  const agreements = data?.data ?? [];
  const filtered = agreements.filter((a: any) => {
    const name = a.profiles?.full_name ?? '';
    const ln = a.loan_number ?? '';
    const matchSearch = !search || name.toLowerCase().includes(search.toLowerCase()) || ln.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

  const totalActive = agreements.filter((a: any) => a.status === 'active').length;

  return (
    <>
      <PageHeader
        title="NCR Registers"
        subtitle="Credit agreement register — all loan agreements on record"
        action={
          <button className="btn btn-secondary" onClick={() => exportCsv(filtered, [
            { key: 'loan_number', label: 'Agreement #' },
            { key: 'profiles.full_name', label: 'Consumer' },
            { key: 'profiles.identity_number', label: 'ID Number' },
            { key: 'principal_amount', label: 'Principal' },
            { key: 'interest_rate', label: 'Rate %' },
            { key: 'status', label: 'Status' },
            { key: 'created_at', label: 'Date' },
          ], 'ncr_registers.csv')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Export
          </button>
        }
      />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <KpiCard label="Total Agreements" value={agreements.length} />
        <KpiCard label="Active" value={totalActive} color="#10B981" />
        <KpiCard label="Closed / Settled" value={agreements.filter((a: any) => a.status === 'repaid' || a.status === 'settled').length} color="#6B7280" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search">
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-text-muted)" }}>search</span>
          <input type="text" placeholder="Search consumer or agreement #…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="admin-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="ALL">All Statuses</option>
          {['active', 'arrears', 'default', 'repaid', 'settled', 'cancelled'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{filtered.length} agreement{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <SkeletonLoader type="table" />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Consumer</th>
                <th>Agreement #</th>
                <th style={{ textAlign: 'right' }}>Principal</th>
                <th>Rate</th>
                <th>Term</th>
                <th>Status</th>
                <th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={7}><EmptyState icon="contract" title="No agreements found" /></td></tr>
                : filtered.map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AvatarCircle name={a.profiles?.full_name ?? '?'} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.profiles?.full_name ?? '—'}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{a.profiles?.identity_number ?? ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{a.loan_number ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(Number(a.principal_amount) || 0)}</td>
                    <td>{a.interest_rate != null ? `${a.interest_rate}%` : '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{a.term_months ? `${a.term_months}m` : '—'}</td>
                    <td>
                      <StatusBadge status={a.status ?? '—'} />
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(a.created_at).toLocaleDateString('en-ZA')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Compliance Tracker ───────────────────────────────────────────────────────

const DEFAULT_TASKS = [
  { category: 'NCR', title: 'Q1 NCR Submission', due_date: `${new Date().getFullYear()}-04-30`, status: 'pending', priority: 'high' },
  { category: 'NCR', title: 'Q2 NCR Submission', due_date: `${new Date().getFullYear()}-07-31`, status: 'pending', priority: 'high' },
  { category: 'NCR', title: 'Q3 NCR Submission', due_date: `${new Date().getFullYear()}-10-31`, status: 'pending', priority: 'high' },
  { category: 'NCR', title: 'Q4 NCR Submission', due_date: `${new Date().getFullYear()}-01-31`, status: 'pending', priority: 'high' },
  { category: 'SACRRA', title: 'Monthly SACRRA data submission', due_date: '', status: 'pending', priority: 'medium' },
  { category: 'FIC', title: 'goAML STR/CTR review', due_date: '', status: 'pending', priority: 'medium' },
  { category: 'Internal', title: 'Credit policy annual review', due_date: '', status: 'pending', priority: 'low' },
  { category: 'Internal', title: 'Staff compliance training', due_date: '', status: 'pending', priority: 'low' },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

export function ComplianceTrackerPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [newTask, setNewTask] = useState({ category: 'NCR', title: '', due_date: '', priority: 'medium', notes: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-compliance-tasks'],
    queryFn: fetchComplianceTasks,
    staleTime: 60_000,
  });

  const updateMut = useMutation({
    mutationFn: (task: Record<string, unknown>) => upsertComplianceTask(task),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-compliance-tasks'] }),
  });

  const createMut = useMutation({
    mutationFn: (task: Record<string, unknown>) => upsertComplianceTask(task),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-compliance-tasks'] }); setShowModal(false); setNewTask({ category: 'NCR', title: '', due_date: '', priority: 'medium', notes: '' }); },
  });

  const tasks = data?.data?.length ? data.data : DEFAULT_TASKS as any[];

  const filtered = tasks
    .filter((t: any) => categoryFilter === 'ALL' || t.category === categoryFilter)
    .sort((a: any, b: any) => (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 3) - (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 3));

  const categories = [...new Set(tasks.map((t: any) => t.category))] as string[];
  const done = tasks.filter((t: any) => t.status === 'completed').length;
  const overdue = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length;

  function toggleStatus(task: any) {
    if (!task.id) return;
    updateMut.mutate({ ...task, status: task.status === 'completed' ? 'pending' : 'completed' });
  }

  return (
    <>
      <PageHeader
        title="Compliance Tracker"
        subtitle="Regulatory task tracking and audit trail"
        action={
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Add Task
          </button>
        }
      />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <KpiCard label="Total Tasks" value={tasks.length} />
        <KpiCard label="Completed" value={done} color="#10B981" />
        <KpiCard label="Pending" value={tasks.length - done} color="#F59E0B" />
        <KpiCard label="Overdue" value={overdue} color={overdue > 0 ? '#EF4444' : '#10B981'} />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <select className="admin-select" style={{ width: 'auto' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="ALL">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>{filtered.length} tasks</span>
      </div>

      {isLoading ? (
        <SkeletonLoader type="table" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0
            ? <EmptyState title="No tasks found" />
            : filtered.map((t: any, i: number) => {
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed';
              return (
                <div key={t.id ?? i} style={{
                  background: 'var(--color-surface-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  opacity: t.status === 'completed' ? 0.6 : 1,
                }}>
                  <input
                    type="checkbox"
                    checked={t.status === 'completed'}
                    onChange={() => toggleStatus(t)}
                    style={{ width: 18, height: 18, accentColor: 'var(--color-primary)', cursor: t.id ? 'pointer' : 'default', flexShrink: 0 }}
                    disabled={!t.id}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, textDecoration: t.status === 'completed' ? 'line-through' : 'none' }}>
                      {t.title}
                    </div>
                    {t.notes && <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{t.notes}</div>}
                  </div>
                  <StatusBadge status={t.category} />
                  <StatusBadge status={t.priority} />
                  {t.due_date && (
                    <span style={{ fontSize: 12, color: isOverdue ? '#EF4444' : 'var(--color-text-muted)', whiteSpace: 'nowrap', fontWeight: isOverdue ? 700 : 400 }}>
                      {isOverdue ? 'Overdue · ' : ''}{new Date(t.due_date).toLocaleDateString('en-ZA')}
                    </span>
                  )}
                </div>
              );
            })
          }
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>New Compliance Task</h3>
              <button className="admin-icon-btn" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Task Title</label>
                <input className="admin-input" type="text" required placeholder="e.g. Q1 NCR Submission…" value={newTask.title} onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Category</label>
                  <select className="admin-select" value={newTask.category} onChange={e => setNewTask(t => ({ ...t, category: e.target.value }))}>
                    {['NCR', 'SACRRA', 'FIC', 'Internal', 'POPIA', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Priority</label>
                  <select className="admin-select" value={newTask.priority} onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Due Date</label>
                <input className="admin-input" type="date" value={newTask.due_date} onChange={e => setNewTask(t => ({ ...t, due_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Notes</label>
                <input className="admin-input" type="text" placeholder="Optional notes…" value={newTask.notes} onChange={e => setNewTask(t => ({ ...t, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!newTask.title || createMut.isPending} onClick={() => createMut.mutate({ ...newTask, status: 'pending' })}>
                {createMut.isPending ? 'Saving…' : 'Save Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── FIC goAML ───────────────────────────────────────────────────────────────

const REPORT_TYPES = ['STR', 'CTR', 'SAR', 'EFT', 'PCR'];

export function GoAMLPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [reportForm, setReportForm] = useState({ report_type: 'STR', subject_name: '', amount: '', description: '', reference: '', report_date: new Date().toISOString().slice(0, 10) });

  const { data, isLoading } = useQuery({
    queryKey: ['admin-goaml-reports'],
    queryFn: fetchGoAMLReports,
    staleTime: 60_000,
  });

  const { data: payoutsRes } = useQuery({
    queryKey: ['admin-payouts-ctr'],
    queryFn: fetchPayouts,
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (r: Record<string, unknown>) => createGoAMLReport(r),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-goaml-reports'] }); setShowModal(false); setReportForm(f => ({ ...f, subject_name: '', amount: '', description: '', reference: '' })); },
  });

  const reports = data?.data ?? [];
  const filtered = reports.filter((r: any) => typeFilter === 'ALL' || r.report_type === typeFilter);

  const strCount = reports.filter((r: any) => r.report_type === 'STR').length;
  const ctrCount = reports.filter((r: any) => r.report_type === 'CTR').length;

  const CTR_THRESHOLD = 24999;
  const allPayouts: any[] = payoutsRes?.data ?? [];
  const ctrFlagged = allPayouts.filter(p =>
    Number(p.amount) > CTR_THRESHOLD &&
    !reports.some((r: any) =>
      r.report_type === 'CTR' && (
        (r.reference && p.id && r.reference.includes(p.id.slice(0, 8))) ||
        (r.subject_name && p.profile?.full_name && r.subject_name === p.profile.full_name)
      )
    )
  );

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);

  return (
    <>
      <PageHeader
        title="FIC goAML"
        subtitle="Financial Intelligence Centre — suspicious and cash transaction reports"
        action={
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            New Report
          </button>
        }
      />

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <KpiCard label="Total Reports" value={reports.length} />
        <KpiCard label="STRs Filed" value={strCount} color="#EF4444" />
        <KpiCard label="CTRs Filed" value={ctrCount} color="#F59E0B" />
        <KpiCard label="Other Reports" value={reports.length - strCount - ctrCount} color="#6B7280" />
      </div>

      {/* ── CTR auto-detection banner ── */}
      {ctrFlagged.length > 0 && (
        <div style={{ marginBottom: 20, borderRadius: 14, border: '1px solid #fcd34d', borderLeftWidth: 4, borderLeftColor: '#d97706', borderLeftStyle: 'solid', background: 'rgba(217,119,6,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(217,119,6,0.15)' }}>
            <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: 20 }}>warning</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>
              {ctrFlagged.length} transaction{ctrFlagged.length !== 1 ? 's' : ''} exceed R24,999 — potential CTR filing required (FIC Act s.28)
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {ctrFlagged.map((p: any, i: number) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderBottom: i < ctrFlagged.length - 1 ? '1px solid rgba(217,119,6,0.1)' : 'none', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#d97706' }}>payments</span>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{p.profile?.full_name ?? 'Unknown'}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>{new Date(p.created_at).toLocaleDateString('en-ZA')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#92400e' }}>{fmt(Number(p.amount))}</span>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 11, padding: '4px 12px', borderRadius: 8 }}
                    onClick={() => {
                      setReportForm(f => ({ ...f, report_type: 'CTR', subject_name: p.profile?.full_name ?? '', amount: String(p.amount), description: `Cash transaction exceeding R24,999 — auto-flagged for FIC CTR compliance`, reference: p.id?.slice(0, 8) ?? '', report_date: new Date(p.created_at).toISOString().slice(0, 10) }));
                      setShowModal(true);
                    }}
                  >
                    File CTR
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <select className="admin-select" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="ALL">All Types</option>
          {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => exportCsv(filtered, [
          { key: 'report_type', label: 'Type' },
          { key: 'subject_name', label: 'Subject' },
          { key: 'amount', label: 'Amount' },
          { key: 'reference', label: 'Reference' },
          { key: 'report_date', label: 'Date' },
        ], 'goaml_reports.csv')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export
        </button>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{filtered.length} report{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <SkeletonLoader type="table" />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Type</th><th>Subject</th><th style={{ textAlign: 'right' }}>Amount</th><th>Description</th><th>Reference</th><th>Date</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={6}><EmptyState icon="security" title="No goAML reports filed" /></td></tr>
                : filtered.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <StatusBadge status={r.report_type} />
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.subject_name ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{r.amount ? fmt(Number(r.amount)) : '—'}</td>
                    <td style={{ fontSize: 12, maxWidth: 240, color: 'var(--color-text-muted)' }}>{r.description ?? '—'}</td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{r.reference ?? r.id?.slice(0, 8) ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{new Date(r.report_date ?? r.created_at).toLocaleDateString('en-ZA')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>New FIC Report</h3>
              <button className="admin-icon-btn" onClick={() => setShowModal(false)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Report Type</label>
                <select className="admin-select" value={reportForm.report_type} onChange={e => setReportForm(f => ({ ...f, report_type: e.target.value }))}>
                  {REPORT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Report Date</label>
                <input className="admin-input" type="date" value={reportForm.report_date} onChange={e => setReportForm(f => ({ ...f, report_date: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Subject Name</label>
                <input className="admin-input" type="text" required placeholder="Individual or entity name…" value={reportForm.subject_name} onChange={e => setReportForm(f => ({ ...f, subject_name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Amount (R)</label>
                <input className="admin-input" type="number" min="0" step="0.01" placeholder="e.g. 25000" value={reportForm.amount} onChange={e => setReportForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Reference</label>
                <input className="admin-input" type="text" placeholder="Optional ref…" value={reportForm.reference} onChange={e => setReportForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Description</label>
                <input className="admin-input" type="text" required placeholder="Brief description of suspicious activity…" value={reportForm.description} onChange={e => setReportForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!reportForm.subject_name || !reportForm.description || createMut.isPending} onClick={() => createMut.mutate({ ...reportForm, amount: reportForm.amount ? Number(reportForm.amount) : null })}>
                {createMut.isPending ? 'Saving…' : 'File Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
