// src/shared/utils.js

export const formatCurrency = (amount) => {
    const num = Number(amount);
    if (isNaN(num)) return 'ZAR 0.00';
    return new Intl.NumberFormat('en-ZA', { 
        style: 'currency', 
        currency: 'ZAR',
        minimumFractionDigits: 2
    }).format(num);
};

// **NEW: Compact formatter for cards (e.g. 1.2k, 1M)**
export const formatCompactNumber = (amount) => {
    const num = Number(amount);
    if (isNaN(num) || num === 0) return 'R 0';
    
    return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1
    }).format(num);
};

export const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('en-ZA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};
// ── Status label formatter — single source of truth for admin ──────
export const STATUS_DISPLAY = {
  'STARTED':           { label: 'In Progress',   color: '#f59e0b', bg: '#fef3c7' },
  'BUREAU_CHECKING':   { label: 'Credit Check',  color: '#3b82f6', bg: '#dbeafe' },
  'BUREAU_OK':         { label: 'Credit Passed', color: '#3b82f6', bg: '#dbeafe' },
  'BUREAU_DECLINE':    { label: 'Declined',      color: '#ef4444', bg: '#fee2e2' },
  'BUREAU_REFER':      { label: 'Under Review',  color: '#f59e0b', bg: '#fef3c7' },
  'AFFORD_OK':         { label: 'Approved',      color: '#10b981', bg: '#d1fae5' },
  'AFFORD_REFER':      { label: 'Under Review',  color: '#f59e0b', bg: '#fef3c7' },
  'OFFERED':           { label: 'Offer Sent',    color: '#8b5cf6', bg: '#ede9fe' },
  'OFFER_ACCEPTED':    { label: 'Accepted',      color: '#10b981', bg: '#d1fae5' },
  'CONTRACT_SIGN':     { label: 'Signing',       color: '#f59e0b', bg: '#fef3c7' },
  'DEBICHECK_AUTH':    { label: 'DebiCheck',     color: '#3b82f6', bg: '#dbeafe' },
  'READY_TO_DISBURSE': { label: 'Approved',      color: '#10b981', bg: '#d1fae5' },
  'DISBURSED':         { label: 'Disbursed',     color: '#10b981', bg: '#d1fae5' },
  'ACTIVE':            { label: 'Active',        color: '#10b981', bg: '#d1fae5' },
  'SETTLED':           { label: 'Settled',       color: '#6b7280', bg: '#f3f4f6' },
  'IN_ARREARS':        { label: 'In Arrears',    color: '#ef4444', bg: '#fee2e2' },
  'IN_DEFAULT':        { label: 'In Default',    color: '#dc2626', bg: '#fee2e2' },
  'CANCELLED':         { label: 'Cancelled',     color: '#6b7280', bg: '#f3f4f6' },
};

export const getStatusLabel = (status) =>
  STATUS_DISPLAY[status]?.label || status;

export const renderStatusBadge = (status) => {
  const s = STATUS_DISPLAY[status] || { label: status, color: '#6b7280', bg: '#f3f4f6' };
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold" style="background:${s.bg};color:${s.color};">${s.label}</span>`;
};

export const validateSAID = (id) => {
    if (!id) return false;
    const str = id.toString().trim();
    if (str.length !== 13 || isNaN(Number(str))) return false;
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        let digit = parseInt(str[i]);
        if (i % 2 !== 0) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(str[12]);
};
