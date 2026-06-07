// SACRRA Validator — validate an external loan book against Layout 700v2 rules
// Use case: client supplies loan book from old system, we validate before migration

import { initLayout } from '../shared/layout.js';

let loadedRecords  = [];
let validatedRows  = [];
let columnMap      = {};

// ─────────────────────────────────────────────
// SA ID VALIDATION (Luhn algorithm)
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
    const yy = parseInt(id.slice(0,2));
    const mm = parseInt(id.slice(2,4));
    const dd = parseInt(id.slice(4,6));
    const century = yy >= 25 ? 1900 : 2000; // crude — adjust per use
    const date = new Date(century + yy, mm - 1, dd);
    if (date.getMonth() !== mm - 1) return null;
    return `${century + yy}${String(mm).padStart(2,'0')}${String(dd).padStart(2,'0')}`;
}

function genderFromID(id) {
    if (!/^\d{13}$/.test(id)) return null;
    return parseInt(id[6]) < 5 ? 'F' : 'M';
}

// ─────────────────────────────────────────────
// RULES — each returns null (pass) or error message
// ─────────────────────────────────────────────
const VALIDATION_RULES = [
    {
        field: 'identity_number',
        label: 'SA ID Number',
        check: (v) => {
            if (!v) return 'Required';
            const s = String(v).replace(/\s/g,'');
            if (!/^\d{13}$/.test(s)) return `Must be 13 digits (got ${s.length})`;
            if (!validateLuhn(s)) return 'Invalid checksum (Luhn fails)';
            return null;
        }
    },
    {
        field: 'date_of_birth',
        label: 'Date of Birth',
        check: (v, row) => {
            if (!v) return 'Required';
            const dob = String(v).replace(/[-\/\s]/g, '');
            if (!/^\d{8}$/.test(dob)) return 'Must be YYYYMMDD format';

            // Must match SA ID
            const id = String(row.identity_number || '').replace(/\s/g,'');
            const idDob = parseDOBFromID(id);
            if (idDob && idDob !== dob) return `Doesn't match SA ID (expected ${idDob})`;
            return null;
        }
    },
    {
        field: 'gender',
        label: 'Gender',
        check: (v, row) => {
            if (!v) return 'Required';
            const g = String(v).toUpperCase().charAt(0);
            if (!['M','F'].includes(g)) return `Must be M or F (got "${v}")`;

            const id = String(row.identity_number || '').replace(/\s/g,'');
            const idGender = genderFromID(id);
            if (idGender && idGender !== g) return `Doesn't match SA ID (expected ${idGender})`;
            return null;
        }
    },
    { field: 'surname',      label: 'Surname',     check: (v) => !v || !String(v).trim() ? 'Required' : (String(v).length > 25 ? `Max 25 chars (got ${String(v).length})` : null) },
    { field: 'first_names',  label: 'First Names', check: (v) => !v || !String(v).trim() ? 'Required' : (String(v).length > 14 ? `Max 14 chars (got ${String(v).length})` : null) },
    { field: 'address',      label: 'Address',     check: (v) => !v || !String(v).trim() ? 'Required (no SACRRA submission without address)' : null },
    {
        field: 'cell_tel_no',
        label: 'Mobile Number',
        check: (v) => {
            if (!v) return null; // optional
            const cleaned = String(v).replace(/[\s\-+]/g,'');
            if (!/^(0|27)\d{9}$/.test(cleaned)) return 'Invalid SA mobile format';
            return null;
        }
    },
    {
        field: 'postal_code',
        label: 'Postal Code',
        check: (v) => {
            if (!v) return null;
            if (!/^\d{4}$/.test(String(v).trim())) return 'Must be 4 digits';
            return null;
        }
    },
    {
        field: 'account_number',
        label: 'Account/Loan Number',
        check: (v) => !v ? 'Required' : null
    },
    {
        field: 'status_code',
        label: 'Status Code',
        check: (v) => {
            const valid = ['C','P','D','T','V','L','W','E','G','K','M','S','I','O','R','N'];
            if (!v) return null; // blank = active per spec
            const s = String(v).trim().toUpperCase();
            if (!valid.includes(s)) return `Invalid status. Valid: ${valid.join(', ')}`;
            return null;
        }
    },
    {
        field: 'opening_balance',
        label: 'Opening Balance',
        check: (v) => {
            if (v === null || v === undefined || v === '') return 'Required';
            const n = parseFloat(String(v).replace(/[R,\s]/g,''));
            if (isNaN(n)) return `Not a number: "${v}"`;
            if (n < 0) return 'Must be >= 0';
            if (n > 999999999) return 'Exceeds N9 max (R999,999,999)';
            return null;
        }
    },
    {
        field: 'current_balance',
        label: 'Current Balance',
        check: (v) => {
            if (v === null || v === undefined || v === '') return 'Required';
            const n = parseFloat(String(v).replace(/[R,\s]/g,''));
            if (isNaN(n)) return `Not a number: "${v}"`;
            if (n < 0) return 'Must be >= 0';
            if (n > 999999999) return 'Exceeds N9 max';
            return null;
        }
    },
    {
        field: 'installment',
        label: 'Monthly Installment',
        check: (v) => {
            if (v === null || v === undefined || v === '') return null;
            const n = parseFloat(String(v).replace(/[R,\s]/g,''));
            if (isNaN(n)) return `Not a number: "${v}"`;
            if (n < 0) return 'Must be >= 0';
            return null;
        }
    },
    {
        field: 'date_opened',
        label: 'Date Account Opened',
        check: (v) => {
            if (!v) return 'Required';
            const d = String(v).replace(/[-\/\s]/g, '');
            if (!/^\d{8}$/.test(d)) return 'Must be YYYYMMDD format';
            const date = new Date(`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`);
            if (isNaN(date.getTime())) return 'Invalid date';
            if (date > new Date()) return 'Cannot be in future';
            return null;
        }
    },
    {
        field: 'term_months',
        label: 'Term (Months)',
        check: (v) => {
            if (!v) return 'Required';
            const n = parseInt(v);
            if (isNaN(n) || n < 1) return 'Must be >= 1';
            if (n > 9999) return 'Max 4 digits';
            return null;
        }
    },
    {
        field: 'months_in_arrears',
        label: 'Months In Arrears',
        check: (v, row) => {
            const n = parseInt(v || 0);
            if (isNaN(n) || n < 0) return 'Must be >= 0';
            if (n > 99) return 'Max 99';

            // Cross-check: if status is current (C) but arrears > 0, that's inconsistent
            const status = String(row.status_code || '').trim().toUpperCase();
            if (['C','P','T','V'].includes(status) && n > 0) {
                return `Arrears > 0 but status is "${status}" (current/closed)`;
            }
            if (status === 'D' && n === 0) {
                return `Status is "D" (defaulted) but arrears = 0`;
            }
            return null;
        }
    }
];

// ─────────────────────────────────────────────
// FIELD MAPPING — auto-detect common column names
// ─────────────────────────────────────────────
const FIELD_ALIASES = {
    identity_number: ['id_number','idnumber','sa_id','said','identity_number','identity','rsa_id','national_id'],
    date_of_birth:   ['dob','date_of_birth','birth_date','birthdate'],
    gender:          ['gender','sex'],
    surname:         ['surname','last_name','lastname','family_name'],
    first_names:     ['first_name','firstname','first_names','given_name','name','forename'],
    address:         ['address','address_1','address1','street_address','residential_address','res_address'],
    cell_tel_no:     ['cell','cellphone','mobile','phone','tel_no','contact_number','cell_tel_no'],
    postal_code:     ['postal','postal_code','postcode','zip'],
    account_number:  ['account_number','account','loan_number','loan_no','ref','reference','contract_no','contract_reference'],
    status_code:     ['status','status_code','loan_status','account_status'],
    opening_balance: ['opening_balance','principal','original_amount','loan_amount','amount','disbursed'],
    current_balance: ['current_balance','outstanding','balance','outstanding_balance','remaining_balance'],
    installment:     ['installment','instalment','monthly_payment','monthly','repayment','emi'],
    date_opened:     ['date_opened','open_date','start_date','disbursed_date','disbursement_date','effective_date'],
    term_months:     ['term','term_months','duration','months','number_of_installments','n_installments'],
    months_in_arrears: ['months_in_arrears','arrears_months','m_in_arrears','overdue_months']
};

function autoMapColumns(headers) {
    const map = {};
    const normalised = headers.map(h => String(h).toLowerCase().replace(/[\s_\-\.]/g,'_').replace(/__+/g,'_'));

    Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
        for (let i = 0; i < normalised.length; i++) {
            const h = normalised[i];
            if (aliases.some(a => h === a || h.includes(a))) {
                map[field] = headers[i];
                break;
            }
        }
    });
    return map;
}

// ─────────────────────────────────────────────
// CSV PARSING (simple — handles quoted fields)
// ─────────────────────────────────────────────
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    function parseLine(line) {
        const cells = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
                if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (c === ',' && !inQuotes) {
                cells.push(cur); cur = '';
            } else { cur += c; }
        }
        cells.push(cur);
        return cells;
    }

    const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g,''));
    const rows = lines.slice(1).map(line => {
        const cells = parseLine(line);
        const obj = {};
        headers.forEach((h, i) => obj[h] = (cells[i] || '').trim().replace(/^"|"$/g,''));
        return obj;
    });
    return { headers, rows };
}

// ─────────────────────────────────────────────
// MAIN VALIDATION
// ─────────────────────────────────────────────
function validateRecords(records, map) {
    return records.map((rec, idx) => {
        const mapped = {};
        Object.entries(map).forEach(([field, sourceCol]) => {
            mapped[field] = rec[sourceCol];
        });

        const errors = [];
        const warnings = [];

        VALIDATION_RULES.forEach(rule => {
            const err = rule.check(mapped[rule.field], mapped);
            if (err) errors.push({ field: rule.label, error: err });
        });

        return {
            row:      idx + 2, // +2 because line 1 is header, rows are 1-indexed
            valid:    errors.length === 0,
            errors,
            warnings,
            original: rec,
            mapped
        };
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
        content.className = 'p-6 max-w-[1400px] mx-auto';
        main.appendChild(content);
    }

    content.innerHTML = `
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span class="material-symbols-outlined" style="color:var(--color-primary,#E7762E)">fact_check</span>
            SACRRA Migration Validator
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">Validate external loan book against Layout 700v2 rules before importing</p>
        </div>
        <a href="/admin/sacrra" class="text-xs font-bold text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">arrow_back</span> Back to SACRRA
        </a>
      </div>

      <!-- Step 1: Upload -->
      <section id="step-upload" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center font-black text-orange-600">1</div>
          <h2 class="font-bold text-gray-900">Upload Loan Book</h2>
        </div>
        <p class="text-sm text-gray-500 mb-4">Upload the loan book CSV that Zwane provided. Auto-detects common column names.</p>
        <input type="file" id="csv-upload" accept=".csv,.txt"
          class="block w-full text-sm border-2 border-dashed border-gray-200 rounded-xl p-6 cursor-pointer hover:border-orange-300 hover:bg-orange-50/30 transition-colors">
        <p class="text-xs text-gray-400 mt-2">Max 50MB. CSV with header row required.</p>
      </section>

      <!-- Step 2: Column mapping -->
      <section id="step-map" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 hidden">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center font-black text-orange-600">2</div>
          <h2 class="font-bold text-gray-900">Column Mapping</h2>
        </div>
        <p class="text-sm text-gray-500 mb-4">Match the columns from the uploaded file to SACRRA fields. Required fields are bold.</p>
        <div id="mapping-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
        <button id="run-validation"
          class="mt-6 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px]">play_arrow</span>
          Validate Records
        </button>
      </section>

      <!-- Step 3: Results -->
      <section id="step-results" class="hidden mb-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div class="bg-white rounded-2xl border border-gray-100 p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Total Records</p>
            <p id="stat-total" class="text-2xl font-black text-gray-900 mt-1">0</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-green-500">Valid</p>
            <p id="stat-valid" class="text-2xl font-black text-green-600 mt-1">0</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-red-500">Errors</p>
            <p id="stat-errors" class="text-2xl font-black text-red-600 mt-1">0</p>
          </div>
          <div class="bg-white rounded-2xl border border-gray-100 p-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-orange-500">Compliance %</p>
            <p id="stat-compliance" class="text-2xl font-black text-orange-600 mt-1">0%</p>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div class="flex gap-1">
              <button data-filter="all" class="filter-tab active px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100">All</button>
              <button data-filter="failed" class="filter-tab px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-gray-50">Failed Only</button>
              <button data-filter="passed" class="filter-tab px-3 py-1.5 text-xs font-bold rounded-lg hover:bg-gray-50">Passed Only</button>
            </div>
            <div class="flex gap-2">
              <button id="btn-download-errors" class="text-xs font-bold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">download</span> Errors CSV
              </button>
              <button id="btn-download-valid" class="text-xs font-bold text-green-600 border border-green-200 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">download</span> Valid CSV
              </button>
            </div>
          </div>
          <div class="overflow-x-auto max-h-[600px]">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 sticky top-0">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Row</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">SA ID</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Balance</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                  <th class="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Issues</th>
                </tr>
              </thead>
              <tbody id="results-tbody" class="divide-y divide-gray-50"></tbody>
            </table>
          </div>
        </div>
      </section>
    `;

    // Wire up file upload
    document.getElementById('csv-upload').addEventListener('change', handleFileUpload);
    document.getElementById('run-validation').addEventListener('click', runValidation);
    document.getElementById('btn-download-errors').addEventListener('click', () => downloadResults('errors'));
    document.getElementById('btn-download-valid').addEventListener('click', () => downloadResults('valid'));

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(t => {
        t.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-tab').forEach(t2 => { t2.classList.remove('active','bg-gray-100'); });
            e.target.classList.add('active','bg-gray-100');
            renderResultsTable(e.target.dataset.filter);
        });
    });
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const { headers, rows } = parseCSV(ev.target.result);
        if (rows.length === 0) { alert('No rows found in file.'); return; }

        loadedRecords = rows;
        columnMap = autoMapColumns(headers);
        renderMappingUI(headers);
        document.getElementById('step-map').classList.remove('hidden');
        document.getElementById('step-map').scrollIntoView({ behavior: 'smooth' });
    };
    reader.readAsText(file);
}

function renderMappingUI(headers) {
    const grid = document.getElementById('mapping-grid');
    const required = ['identity_number','surname','first_names','address','account_number','opening_balance','current_balance','date_opened','term_months'];

    grid.innerHTML = Object.entries(FIELD_ALIASES).map(([field, _]) => {
        const isReq = required.includes(field);
        const fieldLabel = field.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
        return `
          <div class="border border-gray-100 rounded-xl p-3">
            <label class="block text-xs ${isReq ? 'font-black text-gray-900' : 'font-semibold text-gray-500'} uppercase tracking-wide mb-1">
              ${fieldLabel} ${isReq ? '<span class="text-red-500">*</span>' : '<span class="text-gray-300 normal-case">(optional)</span>'}
            </label>
            <select data-field="${field}" class="map-select w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
              <option value="">— Skip —</option>
              ${headers.map(h => `<option value="${h}" ${columnMap[field] === h ? 'selected' : ''}>${h}</option>`).join('')}
            </select>
          </div>`;
    }).join('');

    grid.querySelectorAll('.map-select').forEach(s => {
        s.addEventListener('change', (e) => {
            columnMap[e.target.dataset.field] = e.target.value;
        });
    });
}

function runValidation() {
    if (loadedRecords.length === 0) return;
    validatedRows = validateRecords(loadedRecords, columnMap);

    const valid  = validatedRows.filter(r => r.valid).length;
    const errors = validatedRows.length - valid;
    const pct    = Math.round((valid / validatedRows.length) * 100);

    document.getElementById('stat-total').textContent      = validatedRows.length;
    document.getElementById('stat-valid').textContent      = valid;
    document.getElementById('stat-errors').textContent     = errors;
    document.getElementById('stat-compliance').textContent = pct + '%';

    document.getElementById('step-results').classList.remove('hidden');
    renderResultsTable('all');
    document.getElementById('step-results').scrollIntoView({ behavior: 'smooth' });
}

function renderResultsTable(filter = 'all') {
    const tbody = document.getElementById('results-tbody');
    let rows = validatedRows;
    if (filter === 'failed') rows = rows.filter(r => !r.valid);
    if (filter === 'passed') rows = rows.filter(r => r.valid);

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-12 text-center text-gray-400 text-sm">No records match this filter.</td></tr>`;
        return;
    }

    // Cap at 500 rows for browser perf
    const capped = rows.slice(0, 500);
    tbody.innerHTML = capped.map(r => {
        const id = r.mapped.identity_number || '—';
        const name = (r.mapped.first_names || '') + ' ' + (r.mapped.surname || '');
        const bal  = r.mapped.current_balance ? 'R' + Number(String(r.mapped.current_balance).replace(/[R,\s]/g,'')).toLocaleString('en-ZA') : '—';
        const status = r.mapped.status_code || '—';

        return `
          <tr class="${r.valid ? 'hover:bg-green-50/20' : 'bg-red-50/20 hover:bg-red-50/40'}">
            <td class="px-4 py-2 text-xs font-mono ${r.valid ? 'text-gray-400' : 'text-red-500 font-bold'}">${r.row}</td>
            <td class="px-4 py-2 text-xs font-mono text-gray-700">${id}</td>
            <td class="px-4 py-2 text-xs font-semibold text-gray-900 truncate max-w-[200px]" title="${name}">${name.trim() || '—'}</td>
            <td class="px-4 py-2 text-xs font-bold text-gray-700">${bal}</td>
            <td class="px-4 py-2 text-xs">${status === '—' ? '—' : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700">${status}</span>`}</td>
            <td class="px-4 py-2">
              ${r.valid
                ? `<span class="inline-flex items-center gap-1 text-xs font-bold text-green-600"><span class="material-symbols-outlined text-[14px]">check_circle</span>OK</span>`
                : `<div class="space-y-0.5">${r.errors.slice(0,3).map(e =>
                    `<div class="text-[10px] text-red-600"><strong>${e.field}:</strong> ${e.error}</div>`).join('')}${r.errors.length > 3 ? `<div class="text-[10px] text-gray-400">+${r.errors.length-3} more</div>` : ''}</div>`}
            </td>
          </tr>`;
    }).join('');

    if (rows.length > 500) {
        tbody.innerHTML += `<tr><td colspan="6" class="p-4 text-center text-xs text-gray-400 bg-gray-50">Showing first 500 of ${rows.length}. Download CSV for full list.</td></tr>`;
    }
}

function downloadResults(type) {
    const rows = type === 'valid' ? validatedRows.filter(r => r.valid) : validatedRows.filter(r => !r.valid);
    if (rows.length === 0) { alert('No records to export.'); return; }

    let csv;
    if (type === 'valid') {
        // Export mapped fields for clean import
        const fields = Object.keys(FIELD_ALIASES);
        csv = fields.join(',') + '\n';
        csv += rows.map(r => fields.map(f => `"${(r.mapped[f] || '').toString().replace(/"/g,'""')}"`).join(',')).join('\n');
    } else {
        // Export with errors per row
        csv = 'Row,SA_ID,Name,Errors\n';
        csv += rows.map(r => {
            const name = `${r.mapped.first_names || ''} ${r.mapped.surname || ''}`.trim();
            const errors = r.errors.map(e => `${e.field}: ${e.error}`).join('; ');
            return `${r.row},"${r.mapped.identity_number || ''}","${name}","${errors.replace(/"/g,'""')}"`;
        }).join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `sacrra_${type}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// BOOTSTRAP
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    await initLayout({ pageTitle: 'SACRRA Validator', activeNav: 'sacrra' });
    render();
});
