import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';

const STALL_LABELS = {
  STARTED:        'Started — not submitted',
  BUREAU_CHECKING:'Bureau check in progress',
  BUREAU_OK:      'Offer ready — not viewed',
  BUREAU_REFER:   'Referred — awaiting action',
  OFFERED:        'Offer not accepted',
  OFFER_ACCEPTED: 'Contract not signed',
  CONTRACT_SIGN:  'Contract signed — not finalised',
};

const STALL_COLORS = {
  STARTED:        'bg-slate-100 text-slate-700',
  BUREAU_CHECKING:'bg-blue-100 text-blue-700',
  BUREAU_OK:      'bg-green-100 text-green-700',
  BUREAU_REFER:   'bg-yellow-100 text-yellow-700',
  OFFERED:        'bg-purple-100 text-purple-700',
  OFFER_ACCEPTED: 'bg-orange-100 text-orange-700',
  CONTRACT_SIGN:  'bg-red-100 text-red-700',
};

let currentApps = [];
let filterHours = 24;
let sending = new Set();

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

async function fetchStalled() {
  const token = await getToken();
  const res = await fetch(`/api/admin/stalled-applications?hours=${filterHours}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sendReminder(applicationId) {
  const token = await getToken();
  const res = await fetch('/api/admin/send-reminder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ applicationId })
  });
  return res.json();
}

function fmtDuration(hours) {
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

function fmtCurrency(v) {
  return `R ${Number(v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

function renderRow(app) {
  const stallColor = STALL_COLORS[app.status] || 'bg-gray-100 text-gray-700';
  const stallLabel = STALL_LABELS[app.status] || app.status;
  const urgency = app.hours_stalled >= 168 ? 'text-red-600 font-semibold' : app.hours_stalled >= 48 ? 'text-orange-600' : 'text-slate-500';
  const btnId = `btn-${app.id}`;
  return `
    <div class="card-surface rounded-2xl p-4 flex flex-col gap-3" data-app-id="${app.id}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-on-surface truncate">${app.client_name}</p>
          <p class="text-sm text-on-surface-variant">${app.phone || 'No phone on record'}</p>
        </div>
        <span class="text-xs font-medium px-2 py-1 rounded-full ${stallColor} shrink-0">${stallLabel}</span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="${urgency}">Stalled ${fmtDuration(app.hours_stalled)}</span>
        <span class="text-on-surface-variant">${fmtCurrency(app.amount)}</span>
      </div>
      <button id="${btnId}" data-id="${app.id}" ${!app.phone ? 'disabled' : ''}
        class="send-btn w-full py-2.5 rounded-xl text-sm font-semibold transition-all
               ${app.phone ? 'bg-secondary text-white hover:opacity-90 active:scale-95' : 'bg-surface-variant text-on-surface-variant cursor-not-allowed opacity-50'}">
        ${app.phone ? 'Send Reminder' : 'No phone number'}
      </button>
    </div>`;
}

function renderEmpty() {
  return `
    <div class="col-span-full flex flex-col items-center justify-center py-20 gap-4 text-center">
      <span class="material-symbols-outlined text-5xl text-on-surface-variant">check_circle</span>
      <p class="text-lg font-semibold text-on-surface">All clear!</p>
      <p class="text-sm text-on-surface-variant">No applications have been stalled for more than ${filterHours} hours.</p>
    </div>`;
}

async function load() {
  const grid = document.getElementById('reminders-grid');
  const count = document.getElementById('stall-count');
  const sendAllBtn = document.getElementById('send-all-btn');
  if (!grid) return;

  grid.innerHTML = `<div class="col-span-full flex justify-center py-16"><span class="material-symbols-outlined animate-spin text-3xl text-secondary">progress_activity</span></div>`;

  try {
    currentApps = await fetchStalled();
    const withPhone = currentApps.filter(a => a.phone);

    count.textContent = currentApps.length;
    sendAllBtn.disabled = withPhone.length === 0;
    sendAllBtn.textContent = withPhone.length > 0
      ? `Send All Reminders (${withPhone.length})`
      : 'No contactable apps';

    grid.innerHTML = currentApps.length
      ? currentApps.map(renderRow).join('')
      : renderEmpty();

    // Bind individual send buttons
    grid.querySelectorAll('.send-btn[data-id]').forEach(btn => {
      btn.addEventListener('click', () => handleSend(btn.dataset.id));
    });
  } catch (e) {
    grid.innerHTML = `<div class="col-span-full text-center py-12 text-red-500">Failed to load: ${e.message}</div>`;
  }
}

async function handleSend(appId) {
  if (sending.has(appId)) return;
  sending.add(appId);

  const btn = document.querySelector(`[data-id="${appId}"].send-btn`);
  const original = btn?.textContent;
  if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }

  try {
    const result = await sendReminder(appId);
    if (btn) {
      btn.textContent = result.sent ? '✓ Sent!' : `✗ ${result.error || 'Failed'}`;
      btn.classList.toggle('bg-green-500', !!result.sent);
      btn.classList.toggle('bg-red-400', !result.sent);
      btn.classList.remove('bg-secondary');
    }
  } catch (e) {
    if (btn) { btn.textContent = '✗ Error'; btn.classList.replace('bg-secondary', 'bg-red-400'); }
  } finally {
    sending.delete(appId);
    // Reset button after 3s
    setTimeout(() => {
      if (btn) {
        btn.textContent = original;
        btn.disabled = false;
        btn.classList.add('bg-secondary');
        btn.classList.remove('bg-green-500', 'bg-red-400');
      }
    }, 3000);
  }
}

async function handleSendAll() {
  const btn = document.getElementById('send-all-btn');
  const eligible = currentApps.filter(a => a.phone && !sending.has(a.id));
  if (!eligible.length) return;

  btn.disabled = true;
  btn.textContent = `Sending 0 / ${eligible.length}…`;

  let done = 0;
  for (const app of eligible) {
    await handleSend(app.id);
    done++;
    btn.textContent = `Sending ${done} / ${eligible.length}…`;
  }

  btn.textContent = `✓ All sent (${eligible.length})`;
  setTimeout(() => load(), 2000);
}

async function init() {
  await initLayout();

  const main = document.getElementById('main-content');
  if (!main) return;

  main.innerHTML = `
    <div class="px-4 py-6 max-w-2xl mx-auto space-y-6">

      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-on-surface">Application Reminders</h1>
        <p class="text-sm text-on-surface-variant mt-1">Clients who started but haven't completed their loan application.</p>
      </div>

      <!-- Controls -->
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex rounded-xl overflow-hidden border border-outline-variant text-sm font-medium">
          ${[24, 48, 168].map(h => `
            <button data-hours="${h}" class="filter-btn px-4 py-2 transition-colors ${h === filterHours ? 'bg-secondary text-white' : 'text-on-surface-variant hover:bg-surface-variant'}">
              ${h === 24 ? '24h+' : h === 48 ? '48h+' : '7d+'}
            </button>`).join('')}
        </div>
        <span class="text-sm text-on-surface-variant">Stalled for more than</span>
        <div class="ml-auto">
          <span id="stall-count" class="text-2xl font-bold text-on-surface">—</span>
          <span class="text-sm text-on-surface-variant ml-1">stalled</span>
        </div>
      </div>

      <!-- Send All -->
      <button id="send-all-btn" disabled
        class="w-full py-3 rounded-2xl font-semibold text-sm bg-secondary text-white opacity-60 transition-all hover:opacity-100 disabled:cursor-not-allowed">
        Loading…
      </button>

      <!-- Grid -->
      <div id="reminders-grid" class="grid grid-cols-1 gap-4"></div>

    </div>`;

  // Filter buttons
  main.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      filterHours = Number(btn.dataset.hours);
      main.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.toggle('bg-secondary', b === btn);
        b.classList.toggle('text-white', b === btn);
        b.classList.toggle('text-on-surface-variant', b !== btn);
      });
      load();
    });
  });

  document.getElementById('send-all-btn').addEventListener('click', handleSendAll);

  load();
}

init();
