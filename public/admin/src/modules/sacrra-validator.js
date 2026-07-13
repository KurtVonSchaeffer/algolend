import { initLayout } from '../shared/layout.js';
import { apiFetch } from '../shared/apiFetch.js';

let lastResults   = null;
let activeFilter  = 'all';
let activeTab     = 'live';   // 'live' | 'csv'

// CSV state
let csvRecords    = [];
let csvColumnMap  = {};

// ─────────────────────────────────────────────
// SA ID helpers
// ─────────────────────────────────────────────
function validateLuhn(id) {
    if (!/^\d{13}$/.test(id)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        let n = parseInt(id[i]);
        if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
        sum += n;
    }
    return (10 - sum % 10) % 10 === parseInt(id[12]);
}
function parseDOBFromID(id) {
    if (!/^\d{13}$/.test(id)) return null;
    const yy = parseInt(id.slice(0,2)), mm = parseInt(id.slice(2,4)), dd = parseInt(id.slice(4,6));
    const yr = yy >= 25 ? 1900 + yy : 2000 + yy;
    const d  = new Date(yr, mm - 1, dd);
    if (d.getMonth() !== mm - 1) return null;
    return `${yr}${String(mm).padStart(2,'0')}${String(dd).padStart(2,'0')}`;
}
function genderFromID(id) {
    return /^\d{13}$/.test(id) ? (parseInt(id[6]) < 5 ? 'F' : 'M') : null;
}

// ─────────────────────────────────────────────
// CSV client-side rules (Layout 700v2)
// ─────────────────────────────────────────────
function parseNum(v)  { return parseFloat(String(v || 0).replace(/[R,\s]/g,'')); }
function parseDate(v) {
    if (!v) return null;
    const d = String(v).replace(/[-\/\s]/g,'');
    if (!/^\d{8}$/.test(d)) return null;
    const dt = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`);
    return isNaN(dt.getTime()) ? null : dt;
}
const CUTOFF_36M     = new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000);
const COMPANY_SUFFIX = /\s*(PTY\.?\s*LTD\.?|LTD\.?|\bCC\b|INC\.?|CORP\.?|\(PTY\))\s*$/i;
function normStatus(v) {
    const s = String(v || '').trim().toLowerCase();
    if (['t','paid','closed','settled','repaid','paid_up'].includes(s)) return 'T';
    if (['v','cancelled','rejected','declined'].includes(s))            return 'V';
    return '';
}
function isActive(row) { return normStatus(row.status_code) === ''; }

const CSV_RULES = [
    { field:'identity_number', label:'SA ID (f10)',
      check: v => {
        if (!v) return 'Required';
        const s = String(v).replace(/\s/g,'');
        if (!/^\d{13}$/.test(s)) return `Must be 13 digits (got ${s.length})`;
        if (!validateLuhn(s)) return 'Luhn checksum fails';
        return null;
      }},
    { field:'date_of_birth', label:'Date of Birth (f12)',
      check: (v, r) => {
        if (!v) return 'Required';
        const dob = String(v).replace(/[-\/\s]/g,'');
        if (!/^\d{8}$/.test(dob)) return 'Must be YYYYMMDD';
        const idDob = parseDOBFromID(String(r.identity_number||'').replace(/\s/g,''));
        if (idDob && idDob !== dob) return `Mismatch with SA ID (expected ${idDob})`;
        return null;
      }},
    { field:'gender', label:'Gender (f11)',
      check: (v, r) => {
        if (!v) return 'Required';
        const g = String(v).toUpperCase().charAt(0);
        if (!['M','F'].includes(g)) return `Must be M or F`;
        const ig = genderFromID(String(r.identity_number||'').replace(/\s/g,''));
        if (ig && ig !== g) return `Mismatch with SA ID (expected ${ig})`;
        return null;
      }},
    { field:'surname', label:'Surname (f06)',
      check: v => {
        if (!v || !String(v).trim()) return 'Required';
        const s = String(v).trim();
        if (s.length > 25) return `Max 25 chars (got ${s.length})`;
        if (COMPANY_SUFFIX.test(s)) return 'Contains company suffix — bureaux will reject';
        return null;
      }},
    { field:'first_names', label:'First Names (f07)',
      check: v => {
        if (!v || !String(v).trim()) return 'Required';
        if (String(v).length > 14) return `Max 14 chars (got ${String(v).length})`;
        return null;
      }},
    { field:'address',       label:'Address (f13)',         check: v => (!v || !String(v).trim()) ? 'Required' : null },
    { field:'postal_code',   label:'Postal Code (f17)',     check: v => v && !/^\d{4}$/.test(String(v).trim()) ? 'Must be 4 digits' : null },
    { field:'cell_tel_no',   label:'Mobile (f31)',          check: v => { if (!v) return null; const c = String(v).replace(/[\s\-+]/g,''); return /^(0|27)\d{9}$/.test(c) ? null : 'Invalid SA mobile'; }},
    { field:'account_number',label:'Account Number (f40)',  check: v => !v ? 'Required' : null },
    { field:'account_type',  label:'Account Type (f03)',    check: v => { if (!v) return null; return !['M','P'].includes(String(v).trim().toUpperCase()) ? 'Must be M or P' : null; }},
    { field:'status_code',   label:'Status Code (f50)',
      check: v => {
        if (!v || String(v).trim() === '') return null;
        const s = String(v).trim().toUpperCase();
        if (!['T','V'].includes(s) && !['paid','closed','settled','repaid','cancelled','rejected'].includes(s.toLowerCase()))
            return `Layout 700v2 only uses blank/T/V — got "${v}"`;
        return null;
      }},
    { field:'date_opened', label:'Date Opened (f43)',
      check: v => {
        if (!v) return 'Required';
        const d = parseDate(v);
        if (!d) return 'Must be YYYYMMDD';
        if (d > new Date()) return 'Cannot be in future';
        return null;
      }},
    { field:'date_last_payment', label:'Last Payment (f46)',
      check: (v, r) => {
        if (!isActive(r)) return null;
        const opened = parseDate(r.date_opened);
        if (!opened) return null;
        const days = (Date.now() - opened) / 86400000;
        if (days > 60 && !v) return 'Required for accounts open > 60 days';
        if (v && !parseDate(v)) return 'Must be YYYYMMDD';
        return null;
      }},
    { field:'term_months', label:'Term Months (f42)',
      check: (v, r) => {
        if (String(r.account_type||'').trim().toUpperCase() === 'M') return null;
        if (!v) return 'Required';
        const n = parseInt(v);
        if (isNaN(n) || n < 1) return 'Must be >= 1';
        if (n > 9999) return 'Max 9999';
        return null;
      }},
    { field:'opening_balance', label:'Opening Balance (f41)',
      check: v => {
        if (v===null||v===undefined||v==='') return 'Required';
        const n = parseNum(v);
        if (isNaN(n)) return `Not a number`;
        if (n < 0) return 'Must be >= 0';
        return null;
      }},
    { field:'current_balance', label:'Current Balance (f44)',
      check: (v, r) => {
        if (v===null||v===undefined||v==='') return 'Required';
        const n = parseNum(v);
        if (isNaN(n)) return `Not a number`;
        if (isActive(r) && n === 0) return 'Active account must have balance > 0';
        return null;
      }},
    { field:'installment', label:'Installment (f45)',
      check: (v, r) => {
        if (!isActive(r)) return null;
        const n = parseNum(v);
        if (isNaN(n) || n === 0) return 'Active account must have installment > 0';
        return null;
      }},
    { field:'amount_overdue', label:'Amount Overdue (f49)',
      check: (v, r) => {
        const arrears = parseInt(r.months_in_arrears || 0);
        if (arrears > 0 && (!v || parseNum(v) === 0))
            return `${arrears} month(s) in arrears but overdue amount = 0`;
        return null;
      }},
    { field:'months_in_arrears', label:'Months In Arrears (f53)',
      check: v => {
        const n = parseInt(v || 0);
        if (isNaN(n) || n < 0) return 'Must be >= 0';
        if (n > 99) return 'Max 99';
        return null;
      }},
    { field:'_36m', label:'36-Month Rule',
      check: (_, r) => {
        const d = parseDate(r.date_last_payment) || parseDate(r.status_date);
        if (d && d < CUTOFF_36M) return `Last activity ${d.toISOString().slice(0,10)} > 36 months ago`;
        return null;
      }},
];

const FIELD_ALIASES = {
    identity_number:   ['id_number','idnumber','sa_id','said','identity_number','identity','rsa_id','national_id'],
    date_of_birth:     ['dob','date_of_birth','birth_date','birthdate'],
    gender:            ['gender','sex'],
    surname:           ['surname','last_name','lastname','family_name'],
    first_names:       ['first_name','firstname','first_names','given_name','forename'],
    address:           ['address','address_1','address1','street_address','residential_address'],
    postal_code:       ['postal','postal_code','postcode','zip'],
    cell_tel_no:       ['cell','cellphone','mobile','phone','tel_no','contact_number'],
    account_number:    ['account_number','account','loan_number','loan_no','ref','reference','contract_no'],
    account_type:      ['account_type','type','loan_type','product_type'],
    status_code:       ['status','status_code','loan_status','account_status'],
    status_date:       ['status_date','status_change_date','updated_date'],
    date_opened:       ['date_opened','open_date','start_date','disbursed_date','disbursement_date','effective_date'],
    date_last_payment: ['date_last_payment','last_payment','last_payment_date','repayment_start_date'],
    term_months:       ['term','term_months','duration','months','number_of_installments'],
    opening_balance:   ['opening_balance','principal','original_amount','loan_amount','amount','disbursed'],
    current_balance:   ['current_balance','outstanding','balance','outstanding_balance'],
    installment:       ['installment','instalment','monthly_payment','monthly','repayment','emi'],
    amount_overdue:    ['amount_overdue','overdue_amount','arrears_amount','total_overdue','overdue'],
    months_in_arrears: ['months_in_arrears','arrears_months','m_in_arrears','overdue_months'],
};

function autoMap(headers) {
    const map = {};
    const norm = headers.map(h => String(h).toLowerCase().replace(/[\s\-\.]/g,'_').replace(/__+/g,'_'));
    Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
        for (let i = 0; i < norm.length; i++) {
            if (aliases.some(a => norm[i] === a || norm[i].includes(a))) { map[field] = headers[i]; break; }
        }
    });
    return map;
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    function parseLine(line) {
        const cells = []; let cur = '', q = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') { if (q && line[i+1]==='"') { cur+='"'; i++; } else q=!q; }
            else if (c===',' && !q) { cells.push(cur); cur=''; }
            else cur+=c;
        }
        cells.push(cur); return cells;
    }
    const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g,''));
    const rows = lines.slice(1).map(line => {
        const cells = parseLine(line); const obj = {};
        headers.forEach((h,i) => obj[h] = (cells[i]||'').trim().replace(/^"|"$/g,''));
        return obj;
    });
    return { headers, rows };
}

function validateCSV(records, map) {
    return records.map((rec, idx) => {
        const m = {};
        Object.entries(map).forEach(([f, col]) => { m[f] = col ? rec[col] : undefined; });
        const errors = [];
        CSV_RULES.forEach(rule => {
            const val = rule.field.startsWith('_') ? null : m[rule.field];
            const err = rule.check(val, m);
            if (err) errors.push({ field: rule.label, msg: err });
        });
        return { row: idx+2, valid: errors.length===0, errors,
                 account: m.account_number, name: `${m.first_names||''} ${m.surname||''}`.trim(),
                 status: normStatus(m.status_code)||'active', issues: errors };
    });
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
function render() {
    const shell = document.getElementById('app-shell');
    const main  = shell.querySelector('main') || shell;
    let content = main.querySelector('#validator-content');
    if (!content) {
        content = document.createElement('div');
        content.id = 'validator-content';
        content.className = 'p-6 max-w-5xl mx-auto';
        main.appendChild(content);
    }

    content.innerHTML = `
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span class="material-symbols-outlined" style="color:var(--color-primary,#E7762E)">fact_check</span>
            SACRRA Compliance Validator
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">Layout 700v2 rules — validate live data or test a loan book before importing</p>
        </div>
        <a href="/admin/sacrra" class="text-xs font-bold text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">arrow_back</span> Back to SACRRA
        </a>
      </div>

      <!-- Tab switcher -->
      <div class="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        <button id="tab-live" onclick="window._switchTab('live')"
          class="tab-btn px-5 py-2 text-sm font-bold rounded-lg bg-white shadow-sm text-gray-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-[16px] text-orange-500">database</span> Live Data
        </button>
        <button id="tab-csv" onclick="window._switchTab('csv')"
          class="tab-btn px-5 py-2 text-sm font-bold rounded-lg text-gray-500 hover:text-gray-700 flex items-center gap-2">
          <span class="material-symbols-outlined text-[16px]">upload_file</span> Upload Loan Book
        </button>
      </div>

      <!-- ── LIVE TAB ── -->
      <div id="panel-live">
        <div id="live-cta" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center text-center gap-4 mb-5">
          <span class="material-symbols-outlined text-5xl text-gray-200">shield_check</span>
          <div>
            <p class="font-bold text-gray-900 text-lg">Check your live database</p>
            <p class="text-sm text-gray-500 mt-1">Scans all records in the SACRRA view against the same rules bureaux use to reject submissions.</p>
          </div>
          <button onclick="window._runLive()"
            class="flex items-center gap-2 px-8 py-3 text-white font-bold rounded-xl text-sm shadow-md hover:-translate-y-0.5 transition-transform"
            style="background:var(--color-primary,#E7762E)">
            <span class="material-symbols-outlined text-[18px]">play_arrow</span>
            Run Compliance Check
          </button>
        </div>
        <div id="live-results" class="hidden"></div>
      </div>

      <!-- ── CSV TAB ── -->
      <div id="panel-csv" class="hidden">

        <!-- Step 1 upload -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center font-black text-orange-600 text-sm">1</div>
            <h2 class="font-bold text-gray-900">Upload Loan Book CSV</h2>
          </div>
          <input type="file" id="csv-upload" accept=".csv,.txt"
            class="block w-full text-sm border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
          <p class="text-xs text-gray-400 mt-2">CSV with header row. Column names are auto-detected — common formats supported.</p>
        </div>

        <!-- Step 2 map (hidden until upload) -->
        <div id="csv-step-map" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4 hidden">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center font-black text-orange-600 text-sm">2</div>
            <h2 class="font-bold text-gray-900">Column Mapping <span id="csv-rowcount" class="text-xs font-normal text-gray-400"></span></h2>
          </div>
          <p class="text-xs text-gray-500 mb-4">Auto-detected below. Adjust if any are wrong, then click Validate.</p>
          <div id="csv-map-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-5"></div>
          <button onclick="window._runCSV()"
            class="flex items-center gap-2 px-6 py-3 text-white font-bold rounded-xl text-sm"
            style="background:var(--color-primary,#E7762E)">
            <span class="material-symbols-outlined text-[18px]">play_arrow</span>
            Validate Records
          </button>
        </div>

        <!-- Step 3 results -->
        <div id="csv-results" class="hidden"></div>
      </div>
    `;

    document.getElementById('csv-upload').addEventListener('change', handleCSVUpload);
}

// ─────────────────────────────────────────────
// TAB SWITCH
// ─────────────────────────────────────────────
window._switchTab = function(tab) {
    activeTab = tab;
    document.getElementById('panel-live').classList.toggle('hidden', tab !== 'live');
    document.getElementById('panel-csv').classList.toggle('hidden',  tab !== 'csv');
    document.querySelectorAll('.tab-btn').forEach(b => {
        const isActive = b.id === `tab-${tab}`;
        b.classList.toggle('bg-white',   isActive);
        b.classList.toggle('shadow-sm',  isActive);
        b.classList.toggle('text-gray-900', isActive);
        b.classList.toggle('text-gray-500', !isActive);
    });
};

// ─────────────────────────────────────────────
// LIVE RUN
// ─────────────────────────────────────────────
window._runLive = async function() {
    const cta = document.getElementById('live-cta');
    const btn = cta.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">refresh</span> Checking…';
    try {
        const res  = await apiFetch('/api/sacrra/validate');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Validation failed');
        lastResults = data;
        document.getElementById('live-cta').classList.add('hidden');
        const panel = document.getElementById('live-results');
        panel.classList.remove('hidden');
        panel.innerHTML = buildResultsHTML(data.summary, data.failed, 'live');
        wireResultsEvents('live');
    } catch(err) {
        alert('Error: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">play_arrow</span> Run Compliance Check';
    }
};

// ─────────────────────────────────────────────
// CSV UPLOAD + MAPPING
// ─────────────────────────────────────────────
const REQUIRED_FIELDS = ['identity_number','surname','first_names','address','account_number','opening_balance','current_balance','installment','date_opened','term_months'];

function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        const { headers, rows } = parseCSV(ev.target.result);
        if (!rows.length) { alert('No rows found.'); return; }
        csvRecords = rows;
        csvColumnMap = autoMap(headers);

        const missing = REQUIRED_FIELDS.filter(f => !csvColumnMap[f]);

        if (missing.length === 0) {
            // All required columns detected — show confirmation banner and auto-run
            showAutoMapBanner(headers, rows.length);
        } else {
            // Some required fields undetected — show only those
            showPartialMapUI(headers, rows, missing);
        }
    };
    reader.readAsText(file);
}

function showAutoMapBanner(headers, rowCount) {
    const step = document.getElementById('csv-step-map');
    step.classList.remove('hidden');
    step.innerHTML = `
      <div class="flex items-start gap-4 p-5 bg-green-50 border border-green-200 rounded-2xl mb-4">
        <span class="material-symbols-outlined text-green-500 text-[28px] mt-0.5 shrink-0">check_circle</span>
        <div class="flex-1">
          <p class="font-bold text-green-800">All columns detected automatically</p>
          <p class="text-xs text-green-700 mt-0.5">${rowCount.toLocaleString()} records ready — validating now…</p>
          <div class="flex flex-wrap gap-1.5 mt-3">
            ${Object.entries(csvColumnMap).map(([field, col]) => `
              <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-green-200 rounded-full text-[11px] text-green-700 font-semibold">
                <span class="material-symbols-outlined text-[12px] text-green-500">check</span>
                ${field.replace(/_/g,' ')} → <span class="text-gray-500">${col}</span>
              </span>`).join('')}
          </div>
        </div>
        <button onclick="showFullMapUI()" class="text-xs font-bold text-green-700 underline underline-offset-2 hover:text-green-900 shrink-0 mt-0.5">Edit mapping</button>
      </div>`;
    step.scrollIntoView({ behavior:'smooth' });
    // Auto-run after a short delay so the user sees the confirmation
    setTimeout(() => window._runCSV(), 600);
}

window.showFullMapUI = function() {
    const step = document.getElementById('csv-step-map');
    const allHeaders = Object.keys(csvRecords[0] || {});
    step.innerHTML = buildMapGrid(allHeaders, Object.keys(FIELD_ALIASES), false);
    wireMapSelects(step);
};

function showPartialMapUI(headers, rows, missing) {
    const step = document.getElementById('csv-step-map');
    step.classList.remove('hidden');

    const detected = Object.entries(csvColumnMap);
    step.innerHTML = `
      <div class="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
        <span class="material-symbols-outlined text-amber-500 text-[20px] mt-0.5 shrink-0">warning</span>
        <div>
          <p class="font-bold text-amber-800 text-sm">Couldn't detect ${missing.length} required column${missing.length>1?'s':''}</p>
          <p class="text-xs text-amber-700 mt-0.5">Match them below, then click Validate.</p>
        </div>
      </div>

      ${detected.length ? `
      <div class="mb-4 flex flex-wrap gap-1.5">
        <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 w-full mb-1">Auto-detected</span>
        ${detected.map(([field, col]) => `
          <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-100 rounded-full text-[11px] text-green-700 font-semibold">
            <span class="material-symbols-outlined text-[11px]">check</span>
            ${field.replace(/_/g,' ')} → ${col}
          </span>`).join('')}
      </div>` : ''}

      <p class="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Needs manual match</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        ${missing.map(field => {
            const label = field.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
            return `
              <div class="border-2 border-amber-200 bg-amber-50/50 rounded-xl p-3">
                <label class="block text-[10px] font-bold text-gray-900 uppercase tracking-widest mb-1">
                  ${label} <span class="text-red-500">*</span>
                </label>
                <select data-field="${field}" class="map-sel w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">— Select column —</option>
                  ${headers.map(h => `<option value="${h}">${h}</option>`).join('')}
                </select>
              </div>`;
        }).join('')}
      </div>
      <div class="flex items-center gap-3">
        <button onclick="window._runCSV()"
          class="flex items-center gap-2 px-6 py-3 text-white font-bold rounded-xl text-sm"
          style="background:var(--color-primary,#E7762E)">
          <span class="material-symbols-outlined text-[18px]">play_arrow</span>
          Validate Records
        </button>
        <span class="text-xs text-gray-400">${rows.length.toLocaleString()} records</span>
      </div>`;

    wireMapSelects(step);
    step.scrollIntoView({ behavior:'smooth' });
}

function wireMapSelects(container) {
    container.querySelectorAll('.map-sel').forEach(s =>
        s.addEventListener('change', e => { csvColumnMap[e.target.dataset.field] = e.target.value || undefined; })
    );
}

window._runCSV = function() {
    if (!csvRecords.length) return;
    const rows    = validateCSV(csvRecords, csvColumnMap);
    const failed  = rows.filter(r => !r.valid);
    const passed  = rows.filter(r => r.valid);
    const byField = {};
    failed.forEach(r => r.issues.forEach(i => { byField[i.field] = (byField[i.field]||0)+1; }));
    const summary = { total: rows.length, passed: passed.length, failed: failed.length,
                      compliance: Math.round(passed.length/rows.length*100), by_field: byField };
    const panel = document.getElementById('csv-results');
    panel.classList.remove('hidden');
    panel.innerHTML = buildResultsHTML(summary, failed, 'csv');
    wireResultsEvents('csv', rows);
    panel.scrollIntoView({ behavior:'smooth' });
};

// ─────────────────────────────────────────────
// SHARED RESULTS HTML
// ─────────────────────────────────────────────
function buildResultsHTML(summary, failed, prefix) {
    const byField = summary.by_field || {};
    const sorted  = Object.entries(byField).sort((a,b) => b[1]-a[1]);
    const max     = sorted[0]?.[1] || 1;

    return `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div class="bg-white rounded-2xl border border-gray-100 p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Total</p>
          <p class="text-3xl font-black text-gray-900">${summary.total.toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-2xl border border-green-100 p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-green-500 mb-1">Passing</p>
          <p class="text-3xl font-black text-green-600">${summary.passed.toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-2xl border border-red-100 p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Issues</p>
          <p class="text-3xl font-black text-red-600">${summary.failed.toLocaleString()}</p>
        </div>
        <div class="bg-white rounded-2xl border border-orange-100 p-4 text-center">
          <p class="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1">Compliance</p>
          <p class="text-3xl font-black text-orange-600">${summary.compliance}%</p>
        </div>
      </div>

      ${sorted.length ? `
      <div class="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
        <p class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Issue Breakdown</p>
        <div class="space-y-2">
          ${sorted.map(([field,count]) => `
            <div class="flex items-center gap-3">
              <span class="text-xs font-semibold text-gray-700 w-56 shrink-0">${field}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div class="h-2 rounded-full bg-red-400" style="width:${Math.round(count/max*100)}%"></div>
              </div>
              <span class="text-xs font-bold text-red-600 w-10 text-right">${count}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-wrap gap-2">
          <div class="flex gap-1 flex-wrap">
            <button data-filter="all"     class="ftab-${prefix} px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100">All Issues</button>
            <button data-filter="balance" class="ftab-${prefix} px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-gray-50">Balance</button>
            <button data-filter="id"      class="ftab-${prefix} px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-gray-50">ID / Name</button>
            <button data-filter="payment" class="ftab-${prefix} px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-gray-50">Payment Date</button>
            <button data-filter="stale"   class="ftab-${prefix} px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-gray-50">36-Month</button>
          </div>
          ${prefix==='csv' ? `
          <div class="flex gap-2">
            <button id="${prefix}-dl-errors" class="text-xs font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">download</span> Errors CSV
            </button>
            <button id="${prefix}-dl-valid" class="text-xs font-bold text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">download</span> Valid CSV
            </button>
          </div>` : ''}
        </div>
        <div class="overflow-x-auto max-h-[500px]">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Account</th>
                <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Issues</th>
              </tr>
            </thead>
            <tbody id="tbody-${prefix}"></tbody>
          </table>
        </div>
      </div>
    `;
}

const FILTER_KW = {
    balance: ['balance','installment','overdue'],
    id:      ['id','surname','first names','name'],
    payment: ['payment','last payment'],
    stale:   ['36-month','36 month','stale'],
};

function wireResultsEvents(prefix, allRows) {
    // filter tabs
    document.querySelectorAll(`.ftab-${prefix}`).forEach(t => {
        t.addEventListener('click', e => {
            document.querySelectorAll(`.ftab-${prefix}`).forEach(x => x.classList.remove('bg-gray-100'));
            e.target.classList.add('bg-gray-100');
            renderResultsTbody(prefix, e.target.dataset.filter, allRows);
        });
    });

    // downloads (CSV mode only)
    const dlErr = document.getElementById(`${prefix}-dl-errors`);
    const dlVal = document.getElementById(`${prefix}-dl-valid`);
    if (dlErr && allRows) dlErr.addEventListener('click', () => downloadCSV(allRows.filter(r=>!r.valid), 'errors'));
    if (dlVal && allRows) dlVal.addEventListener('click', () => downloadCSV(allRows.filter(r=>r.valid),  'valid'));

    // initial render
    renderResultsTbody(prefix, 'all', allRows);
}

function renderResultsTbody(prefix, filter, allRows) {
    const tbody  = document.getElementById(`tbody-${prefix}`);
    const source = allRows ? allRows.filter(r => !r.valid) : (lastResults?.failed || []);
    const kw     = FILTER_KW[filter];
    const rows   = filter === 'all' ? source : source.filter(r =>
        r.issues.some(i => kw.some(k => i.field.toLowerCase().includes(k) || i.msg.toLowerCase().includes(k)))
    );

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-gray-400 text-sm">
          ${filter==='all' ? '✅ No issues — all records pass Layout 700v2.' : 'No records match this filter.'}
        </td></tr>`;
        return;
    }

    tbody.innerHTML = rows.slice(0,500).map(r => `
      <tr class="border-t border-gray-50 hover:bg-red-50/30">
        <td class="px-4 py-3 text-xs font-mono text-gray-600">${r.account || r.id || `Row ${r.row}`}</td>
        <td class="px-4 py-3 text-xs font-semibold text-gray-900 max-w-[180px] truncate">${r.name||'—'}</td>
        <td class="px-4 py-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
            r.status==='T'?'bg-gray-100 text-gray-500':r.status==='V'?'bg-purple-50 text-purple-600':'bg-green-50 text-green-700'
          }">${r.status==='T'?'CLOSED':r.status==='V'?'VOID':'ACTIVE'}</span>
        </td>
        <td class="px-4 py-3">
          <div class="space-y-0.5">
            ${r.issues.slice(0,4).map(i=>`
              <div class="flex items-start gap-1">
                <span class="material-symbols-outlined text-red-400 text-[12px] mt-0.5 shrink-0">error</span>
                <span class="text-[11px] text-gray-700"><strong class="text-red-600">${i.field}:</strong> ${i.msg}</span>
              </div>`).join('')}
            ${r.issues.length>4?`<div class="text-[10px] text-gray-400 pl-4">+${r.issues.length-4} more</div>`:''}
          </div>
        </td>
      </tr>`).join('');

    if (rows.length > 500) {
        tbody.innerHTML += `<tr><td colspan="4" class="p-3 text-center text-xs text-gray-400 bg-gray-50">
          Showing 500 of ${rows.length}. Download Errors CSV for full list.
        </td></tr>`;
    }
}

function downloadCSV(rows, type) {
    if (!rows.length) { alert('No records.'); return; }
    let csv;
    if (type === 'valid') {
        const fields = Object.keys(FIELD_ALIASES);
        csv = fields.join(',') + '\n' + rows.map(r => fields.map(f => `"${(r.mapped?.[f]||'').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
    } else {
        csv = 'Row,Account,Name,Errors\n' + rows.map(r =>
            `${r.row||''},"${r.account||''}","${r.name||''}","${r.issues.map(i=>`${i.field}: ${i.msg}`).join('; ').replace(/"/g,'""')}"`
        ).join('\n');
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }));
    a.download = `sacrra_${type}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ─────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await initLayout({ pageTitle: 'SACRRA Validator', activeNav: 'sacrra' });
    render();
});
