// Notifications page JS
import '/user-portal/Services/sessionGuard.js';
import { supabase } from '/Services/supabaseClient.js';

// ── State ────────────────────────────────────────────────────────────
let allNotifications = [];
let activeFilter     = 'all';

// ── Type → icon + category mapping ───────────────────────────────────
const TYPE_META = {
  loan_approved:       { icon: 'fa-check-circle',    cls: 'type-loan',     cat: 'loan'    },
  loan_declined:       { icon: 'fa-times-circle',    cls: 'type-alert',    cat: 'loan'    },
  loan_disbursed:      { icon: 'fa-money-bill-wave', cls: 'type-loan',     cat: 'loan'    },
  loan_offer:          { icon: 'fa-file-invoice',    cls: 'type-loan',     cat: 'loan'    },
  application_submitted:{ icon: 'fa-paper-plane',   cls: 'type-loan',     cat: 'loan'    },
  payment_due:         { icon: 'fa-calendar-alt',    cls: 'type-payment',  cat: 'payment' },
  payment_received:    { icon: 'fa-check',           cls: 'type-payment',  cat: 'payment' },
  payment_missed:      { icon: 'fa-exclamation-circle', cls: 'type-alert', cat: 'payment' },
  document_requested:  { icon: 'fa-file-upload',     cls: 'type-document', cat: 'system'  },
  document_approved:   { icon: 'fa-file-check',      cls: 'type-document', cat: 'system'  },
  account_updated:     { icon: 'fa-user-edit',       cls: 'type-account',  cat: 'system'  },
  default:             { icon: 'fa-bell',            cls: 'type-system',   cat: 'system'  },
};

function getMeta(type) {
  return TYPE_META[type] || TYPE_META.default;
}

// ── Time formatting ───────────────────────────────────────────────────
function formatTime(dateStr) {
  const date   = new Date(dateStr);
  const now    = new Date();
  const diff   = Math.floor((now - date) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function getDateGroup(dateStr) {
  const date = new Date(dateStr);
  const now  = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return 'This week';
  if (diffDays < 30) return 'This month';
  return 'Earlier';
}

// ── Render ────────────────────────────────────────────────────────────
function render() {
  const container = document.getElementById('notificationsContainer');
  if (!container) return;

  const catMap = { loan: ['loan'], payment: ['payment'], system: ['system'] };
  const filtered = allNotifications.filter(n => {
    if (activeFilter === 'all')    return true;
    if (activeFilter === 'unread') return !n.is_read;
    const meta = getMeta(n.type);
    return catMap[activeFilter]?.includes(meta.cat);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon"><i class="fas fa-bell-slash"></i></div>
        <h3>${activeFilter === 'unread' ? 'All caught up!' : 'No notifications'}</h3>
        <p>${activeFilter === 'unread' ? 'You have no unread notifications.' : 'Nothing here yet — check back later.'}</p>
      </div>`;
    return;
  }

  // Group by date
  const groups = {};
  filtered.forEach(n => {
    const label = getDateGroup(n.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  });

  const ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier'];
  let html = '';

  ORDER.forEach(label => {
    if (!groups[label]) return;
    html += `<div class="notif-date-group"><p class="notif-date-label">${label}</p></div>`;
    groups[label].forEach(n => {
      const meta    = getMeta(n.type);
      const unread  = !n.is_read ? 'unread' : '';
      html += `
        <div class="notif-item ${unread}" data-id="${n.id}" onclick="markRead('${n.id}', this)">
          <div class="notif-icon ${meta.cls}">
            <i class="fas ${meta.icon}"></i>
          </div>
          <div class="notif-body">
            <p class="notif-title">${n.title || 'Notification'}</p>
            <p class="notif-message">${n.message || ''}</p>
          </div>
          <div class="notif-meta">
            <span class="notif-time">${formatTime(n.created_at)}</span>
            ${!n.is_read ? '<span class="notif-dot"></span>' : ''}
          </div>
        </div>`;
    });
  });

  container.innerHTML = html;
}

function updateUnreadBadge() {
  const count  = allNotifications.filter(n => !n.is_read).length;
  const badge  = document.getElementById('unreadBadge');
  const markBtn = document.getElementById('markAllReadBtn');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
  if (markBtn) markBtn.style.display = count > 0 ? 'inline-flex' : 'none';
}

// ── Actions ───────────────────────────────────────────────────────────
window.markRead = async (id, el) => {
  const notif = allNotifications.find(n => n.id === id);
  if (!notif || notif.is_read) return;
  notif.is_read = true;
  el?.classList.remove('unread');
  el?.querySelector('.notif-dot')?.remove();
  el?.querySelector('.notif-title') && (el.querySelector('.notif-title').style.fontWeight = '700');
  updateUnreadBadge();
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
};

async function markAllRead() {
  const unread = allNotifications.filter(n => !n.is_read);
  if (!unread.length) return;
  unread.forEach(n => { n.is_read = true; });
  render();
  updateUnreadBadge();
  const ids = unread.map(n => n.id);
  await supabase.from('notifications').update({ is_read: true }).in('id', ids);
}

// ── Filters ───────────────────────────────────────────────────────────
function setupFilters() {
  document.querySelectorAll('.notif-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.notif-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      render();
    });
  });

  const markBtn = document.getElementById('markAllReadBtn');
  if (markBtn) markBtn.addEventListener('click', markAllRead);
}

// ── Boot ──────────────────────────────────────────────────────────────
async function boot() {
  setupFilters();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.replace('/auth/login.html');
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    allNotifications = data || [];
    render();
    updateUnreadBadge();

    // Real-time updates
    supabase
      .channel('notifications-feed')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${session.user.id}`
      }, payload => {
        allNotifications.unshift(payload.new);
        render();
        updateUnreadBadge();
      })
      .subscribe();

  } catch (err) {
    console.error('[Notifications]', err);
    const container = document.getElementById('notificationsContainer');
    if (container) container.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <h3>Could not load notifications</h3>
        <p>Please try refreshing the page.</p>
      </div>`;
  }
}

boot();
