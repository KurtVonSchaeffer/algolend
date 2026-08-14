// src/modules/settings.js
import { initLayout } from '../shared/layout.js';
import { supabase } from '../services/supabaseClient.js';
import {
  fetchUsers,
  fetchBranches,
  updateMyProfile,
  updateUserRole,
  getPaymentMethods,
  addPaymentMethod,
  updateMyAvatar,
  fetchSystemSettings,
  updateSystemSettings,
  DEFAULT_SYSTEM_SETTINGS
} from '../services/dataService.js';
import { apiFetch } from '../shared/apiFetch.js';
import {
  ensureThemeLoaded,
  previewTheme,
  persistTheme,
  resetThemePreview,
  getCachedTheme
} from '../shared/theme.js';

// =============================================================================
// 1. STATE & CONSTANTS
// =============================================================================

// User State
let userRole = 'borrower';
let currentUserProfile = null;
let allUsers = [];
let filteredUsers = [];
let isUploading = false; // For Avatar

// System Settings State
let systemSettings = { ...DEFAULT_SYSTEM_SETTINGS };
let systemSettingsDraft = { ...DEFAULT_SYSTEM_SETTINGS };
let themeHasPendingChanges = false;
let isSavingTheme = false;
let systemSettingsMetadata = { updated_at: null, updated_by: null };
let isUploadingLogo = false;
let isUploadingWallpaper = false;

// Constants
const BRANDING_STORAGE_BUCKET = 'avatars';
const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_WALLPAPER_FILE_SIZE = 6 * 1024 * 1024; // 6 MB
const ALLOWED_WALLPAPER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const COLOR_FIELDS = [
  { key: 'primary_color', label: 'Primary Color', description: 'Used for CTAs, highlights and primary focus states.' },
  { key: 'secondary_color', label: 'Secondary Color', description: 'Used for gradients, hover states and charts.' },
  { key: 'tertiary_color', label: 'Tertiary Color', description: 'Used for gradients and subtle accents.' }
];

// =============================================================================
// 2. HELPERS (UI, FORMATTING, THEME)
// =============================================================================

// --- Role Badges ---
const getRoleBadge = (role) => {
  switch (role) {
    case 'super_admin': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'admin': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'base_admin': return 'bg-orange-100 text-orange-700 border-orange-200';
    default: return 'bg-green-50 text-green-700 border-green-200';
  }
};

const getRoleLabel = (role) => {
    switch(role) {
        case 'super_admin': return 'SUPER ADMIN';
        case 'admin': return 'LOAN MANAGER';
        case 'base_admin': return 'LOAN OFFICER';
        default: return 'CLIENT';
    }
};

// --- Avatar Renderer ---
const renderAvatar = (profile, options = {}) => {
  const { sizeClass = 'w-10 h-10', textClass = 'text-sm' } = options;
  const name = profile.full_name || 'U';
  
  if (profile.avatar_url) {
    return `<img src="${profile.avatar_url}" class="${sizeClass} rounded-full object-cover border border-gray-200 shadow-sm" alt="${name}">`;
  }
  return `
    <div class="${sizeClass} rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center ${textClass} font-bold text-gray-600">
      ${name.charAt(0).toUpperCase()}
    </div>
  `;
};

// --- Toast Notification ---
const showToast = (message, type = 'success') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const colors = type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white';
  const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
  
  toast.className = `${colors} px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 transform transition-all duration-300 translate-y-4 opacity-0 min-w-[300px] pointer-events-auto`;
  toast.innerHTML = `${icon}<span class="font-medium text-sm">${message}</span>`;
  
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('translate-y-4', 'opacity-0'));
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// --- Theme Normalizers ---
const cloneCarouselSlides = (slides = []) => {
  if (!Array.isArray(slides)) return []; 
  return slides.map((slide = {}) => ({
    title: typeof slide.title === 'string' ? slide.title : '',
    text: typeof slide.text === 'string' ? slide.text : ''
  }));
};

const ensureCarouselSlides = (slides) => {
  const fallback = DEFAULT_SYSTEM_SETTINGS.carousel_slides || [];
  const incoming = cloneCarouselSlides(Array.isArray(slides) && slides.length ? slides : fallback);
  const length = fallback.length || 3;
  while (incoming.length < length) {
    const ref = fallback[incoming.length] || { title: '', text: '' };
    incoming.push({ ...ref });
  }
  return incoming.slice(0, length).map((slide, index) => ({
    title: slide.title?.trim() || fallback[index]?.title || '',
    text: slide.text?.trim() || fallback[index]?.text || ''
  }));
};

const normalizeBooleanSetting = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return fallback;
};

const normalizeHex = (value) => {
  if (!value) return null;
  let hex = value.trim().replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('');
  return /^[0-9A-Fa-f]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : null;
};

const normalizeCompanyName = (value) => {
  return (typeof value === 'string' ? value.trim() : '') || DEFAULT_SYSTEM_SETTINGS.company_name;
};

const cloneSystemSettings = (settings = {}) => ({
  ...DEFAULT_SYSTEM_SETTINGS,
  ...settings,
  company_name: normalizeCompanyName(settings?.company_name),
  auth_overlay_color: normalizeHex(settings?.auth_overlay_color) || DEFAULT_SYSTEM_SETTINGS.auth_overlay_color,
  auth_overlay_enabled: normalizeBooleanSetting(settings?.auth_overlay_enabled, DEFAULT_SYSTEM_SETTINGS.auth_overlay_enabled),
  auth_background_flip: normalizeBooleanSetting(settings?.auth_background_flip, DEFAULT_SYSTEM_SETTINGS.auth_background_flip),
  carousel_slides: ensureCarouselSlides(settings?.carousel_slides)
});

const getCarouselSlidesDraft = () => ensureCarouselSlides(systemSettingsDraft?.carousel_slides || []);

const escapeHtmlAttr = (value = '') => (value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const escapeHtmlContent = (value = '') => (value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// =============================================================================
// 3. THEME PREVIEW & LOGIC
// =============================================================================

const updateThemePreviewUI = () => {
  COLOR_FIELDS.forEach(({ key }) => {
    const colorInput = document.querySelector(`[data-color-picker="${key}"]`);
    const hexInput = document.querySelector(`[data-color-input="${key}"]`);
    if (colorInput) colorInput.value = systemSettingsDraft[key];
    if (hexInput) hexInput.value = systemSettingsDraft[key];
  });

  const preview = document.getElementById('brand-gradient-preview');
  if (preview) {
    preview.style.backgroundImage = `linear-gradient(120deg, ${systemSettingsDraft.primary_color}, ${systemSettingsDraft.secondary_color}, ${systemSettingsDraft.tertiary_color})`;
  }

  document.querySelectorAll('[data-theme-mode]').forEach((btn) => {
    if (btn.dataset.themeMode === systemSettingsDraft.theme_mode) {
      btn.classList.add('bg-gray-900', 'text-white', 'shadow');
      btn.classList.remove('text-gray-600', 'bg-white');
    } else {
      btn.classList.remove('bg-gray-900', 'text-white', 'shadow');
      btn.classList.add('text-gray-600', 'bg-white');
    }
  });

  updateLogoPreviewUI();
  updateWallpaperPreviewUI();
  updateOverlayControlsUI();
  updateCarouselFieldsUI();
  updateThemeSaveState();
};

const updateThemeSaveState = () => {
  const saveBtn = document.getElementById('save-system-settings');
  const status = document.getElementById('system-settings-status');

  if (saveBtn) {
    saveBtn.disabled = !themeHasPendingChanges || isSavingTheme;
    saveBtn.innerHTML = isSavingTheme
      ? '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Saving'
      : 'Save Changes';
  }
  if (status) {
    status.textContent = themeHasPendingChanges ? 'Unsaved changes' : 'Theme saved';
    status.className = themeHasPendingChanges ? 'text-xs text-orange-600 font-bold' : 'text-xs text-green-600 font-bold';
  }
};

const markThemeDirty = () => {
  themeHasPendingChanges = true;
  updateThemeSaveState();
};

const commitThemeDraft = (patch) => {
  const sanitizedPatch = { ...patch };
  if (patch.carousel_slides) {
    sanitizedPatch.carousel_slides = ensureCarouselSlides(patch.carousel_slides);
  }
  systemSettingsDraft = cloneSystemSettings({ ...systemSettingsDraft, ...sanitizedPatch });
  markThemeDirty();
  previewTheme(systemSettingsDraft);
  updateThemePreviewUI();
};

const getLogoValue = () => (systemSettingsDraft.company_logo_url || '').trim();
const getWallpaperValue = () => (systemSettingsDraft.auth_background_url || '').trim();

const updateLogoPreviewUI = () => {
  const logoUrl = getLogoValue();
  const previewImg = document.getElementById('company-logo-preview');
  const emptyState = document.getElementById('company-logo-empty');
  const removeBtn = document.getElementById('remove-logo-btn');
  const linkInput = document.getElementById('logo-url-input');

  if (previewImg) {
    if (logoUrl) {
      previewImg.src = logoUrl;
      previewImg.classList.remove('hidden');
      if (emptyState) emptyState.classList.add('hidden');
    } else {
      previewImg.src = '';
      previewImg.classList.add('hidden');
      if (emptyState) emptyState.classList.remove('hidden');
    }
  }
  if (removeBtn) removeBtn.disabled = !logoUrl || isUploadingLogo;
  if (linkInput && document.activeElement !== linkInput) linkInput.value = logoUrl;
};

const updateWallpaperPreviewUI = () => {
  const url = getWallpaperValue();
  const isFlipped = normalizeBooleanSetting(systemSettingsDraft.auth_background_flip, false);
  const preview = document.getElementById('auth-bg-preview');
  const empty = document.getElementById('auth-bg-empty');
  const flipToggle = document.getElementById('wallpaper-flip-toggle');
  const removeBtn = document.getElementById('remove-wallpaper-btn');
  const linkInput = document.getElementById('wallpaper-url-input');

  if (preview) {
    preview.style.backgroundImage = url ? `url('${url}')` : 'none';
    preview.style.transform = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
    if (empty) empty.classList.toggle('hidden', !!url);
  }
  if (flipToggle) flipToggle.checked = isFlipped;
  if (removeBtn) removeBtn.disabled = !url || isUploadingWallpaper;
  if (linkInput && document.activeElement !== linkInput) linkInput.value = url;
};

const updateOverlayControlsUI = () => {
  const color = normalizeHex(systemSettingsDraft.auth_overlay_color) || DEFAULT_SYSTEM_SETTINGS.auth_overlay_color;
  const enabled = normalizeBooleanSetting(systemSettingsDraft.auth_overlay_enabled, true);
  
  const picker = document.getElementById('overlay-color-picker');
  const input = document.getElementById('overlay-color-input');
  const toggle = document.getElementById('overlay-disable-toggle');

  if (picker) picker.value = color;
  if (input) input.value = color;
  if (toggle) toggle.checked = !enabled;
};

const updateCarouselFieldsUI = () => {
  const slides = getCarouselSlidesDraft();
  slides.forEach((slide, index) => {
    const titleInput = document.querySelector(`[data-carousel-field="title"][data-carousel-index="${index}"]`);
    const textInput = document.querySelector(`[data-carousel-field="text"][data-carousel-index="${index}"]`);
    if (titleInput && titleInput !== document.activeElement) titleInput.value = slide.title;
    if (textInput && textInput !== document.activeElement) textInput.value = slide.text;
  });
};

// =============================================================================
// 4. MAIN PAGE & TABS
// =============================================================================

function renderPageContent() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  mainContent.innerHTML = `
    <div class="glass-card rounded-2xl h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
      <div class="flex border-b border-outline-variant/10 bg-surface-container-lowest px-6 overflow-x-auto">
        <button class="tab-btn active" data-tab="profile"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">badge</span>My Profile</button>
        <button class="tab-btn" data-tab="security"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">shield</span>Security</button>
        ${userRole === 'super_admin' ? `
          <button class="tab-btn" data-tab="users"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">manage_accounts</span>User Management</button>
          <button class="tab-btn" data-tab="billing"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">credit_card</span>Billing</button>
          <button class="tab-btn" data-tab="system"><span class="material-symbols-outlined text-[16px] mr-2 align-middle">tune</span>System Branding</button>
        ` : ''}
      </div>

      <div id="tab-content" class="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar relative"></div>
    </div>

    <div id="role-modal" class="hidden fixed inset-0 bg-gray-900/50 z-50 flex items-center justify-center backdrop-blur-sm">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Change User Role</h3>
            <div class="bg-blue-50 p-3 rounded-lg mb-4 flex items-start gap-3">
                <i class="fa-solid fa-circle-info text-blue-500 mt-0.5"></i>
                <div class="text-sm text-blue-800">
                    User: <strong id="modal-user-name">...</strong><br>
                    Current Role: <span id="modal-current-role" class="uppercase text-xs font-bold">...</span>
                </div>
            </div>
            <form id="role-form">
                <input type="hidden" id="modal-user-id">
                <label class="block text-xs font-bold text-gray-500 uppercase mb-2">New Role Assignment</label>
                <select id="modal-role-select" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500 mb-6">
                    <option value="borrower">Client (Borrower)</option>
                    <option value="base_admin">Loan Officer (Base Admin)</option>
                    <option value="admin">Branch Manager (Admin)</option>
                    <option value="super_admin">Super Admin</option>
                </select>
                <div class="flex justify-end gap-3">
                    <button type="button" onclick="document.getElementById('role-modal').classList.add('hidden')" class="px-4 py-2 text-gray-600 font-bold text-sm hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button type="submit" class="px-4 py-2 bg-gray-900 text-white font-bold text-sm rounded-lg hover:bg-black shadow-sm">Save Changes</button>
                </div>
            </form>
        </div>
    </div>
  `;

  // Styles
  const style = document.createElement('style');
  style.innerHTML = `
    .tab-btn { padding: 1rem 1.5rem; font-size: 0.875rem; font-weight: 600; color: #6B7280; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; }
    .tab-btn:hover { color: #111827; background: rgba(0,0,0,0.03); }
    .tab-btn.active { color: var(--color-primary, #EA580C); border-bottom-color: var(--color-primary, #EA580C); background: #FFF; }
  `;
  document.head.appendChild(style);

  attachTabListeners();
  renderProfileTab(); 
}

function attachTabListeners() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.onclick = () => {
            tabs.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            const tabName = btn.dataset.tab;
            
            if(tabName === 'profile') renderProfileTab();
            else if(tabName === 'security') renderSecurityTab();
            else if(tabName === 'users') renderUserManagementTab();
            else if(tabName === 'billing') renderBillingTab();
            else if(tabName === 'system') renderSystemSettingsTab();
        };
    });

    const roleForm = document.getElementById('role-form');
    if(roleForm) {
        roleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const uid = document.getElementById('modal-user-id').value;
            const role = document.getElementById('modal-role-select').value;
            try {
                const { error } = await updateUserRole(uid, role);
                if(error) throw new Error(error);
                showToast('Role updated successfully', 'success');
                document.getElementById('role-modal').classList.add('hidden');
                renderUserManagementTab();
            } catch(err) {
                showToast(err.message, 'error');
            }
        });
    }
}

// --- TAB RENDERING FUNCTIONS ---

function renderProfileTab() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="max-w-2xl animate-fade-in">
            <h2 class="text-2xl font-headline font-bold text-on-surface mb-1">My Profile</h2>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-8">Manage your personal account details.</p>
            <div class="glass-card p-8 rounded-2xl">
                <div class="flex items-center gap-6 mb-8">
                    <div class="relative group cursor-pointer w-20 h-20">
                        ${renderAvatar({ ...currentUserProfile, avatar_url: currentUserProfile.avatar_url }, { sizeClass: 'w-20 h-20', textClass: 'text-2xl' })} 
                        <div class="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <i class="fa-solid fa-camera text-white"></i>
                        </div>
                        <input type="file" id="avatar-input" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*">
                        <div id="avatar-spinner" class="absolute inset-0 w-full h-full bg-black/70 rounded-full flex items-center justify-center hidden"><i class="fa-solid fa-spinner fa-spin text-white"></i></div>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-gray-900">${currentUserProfile.full_name || 'User'}</h3>
                        <p class="text-sm text-gray-500">${currentUserProfile.email || ''}</p>
                        <span class="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase border border-gray-200">
                            ${getRoleLabel(currentUserProfile.role)}
                        </span>
                    </div>
                </div>
                <form id="profile-form" class="space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Full Name</label>
                            <input type="text" id="prof-name" value="${currentUserProfile.full_name || ''}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Contact Number</label>
                            <input type="text" id="prof-phone" value="${currentUserProfile.contact_number || ''}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                        </div>
                    </div>
                    <div class="flex justify-end pt-4">
                        <button type="submit" id="save-profile" class="px-6 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-lg hover:bg-black shadow-lg transition-all">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('save-profile');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            const updates = { full_name: document.getElementById('prof-name').value, contact_number: document.getElementById('prof-phone').value };
            const { error } = await updateMyProfile(updates);
            if(error) throw new Error(error);
            currentUserProfile = { ...currentUserProfile, ...updates };
            showToast('Profile Updated', 'success');
        } catch(err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    });

    document.getElementById('avatar-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        isUploading = true;
        document.getElementById('avatar-spinner').classList.remove('hidden');
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${currentUserProfile.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
            if(uploadError) throw uploadError;
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            await updateMyAvatar(data.publicUrl);
            currentUserProfile.avatar_url = data.publicUrl;
            renderProfileTab();
            showToast('Avatar updated', 'success');
        } catch(err) {
            showToast('Failed to upload: ' + err.message, 'error');
        } finally {
            isUploading = false;
        }
    });
}

function renderSecurityTab() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="max-w-2xl animate-fade-in">
            <h2 class="text-2xl font-headline font-bold text-on-surface mb-1">Security</h2>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-8">Update your password and security settings.</p>
            <div class="glass-card p-8 rounded-2xl">
                <form id="security-form" class="space-y-5">
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">New Password</label>
                        <input type="password" id="sec-pass" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="••••••••">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Confirm Password</label>
                        <input type="password" id="sec-confirm" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="••••••••">
                    </div>
                    <div class="pt-4">
                        <button type="submit" class="px-6 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-lg hover:bg-black shadow-lg transition-all">Update Password</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('security-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pass = document.getElementById('sec-pass').value;
        const confirm = document.getElementById('sec-confirm').value;
        if(pass !== confirm) return showToast('Passwords do not match', 'error');
        if(pass.length < 6) return showToast('Password too short (min 6 chars)', 'error');
        const { error } = await supabase.auth.updateUser({ password: pass });
        if(error) showToast(error.message, 'error');
        else {
            showToast('Password updated successfully', 'success');
            e.target.reset();
        }
    });
}

// --- USER MANAGEMENT TAB (full Users page merged in) ---
async function renderUserManagementTab() {
  const container = document.getElementById('tab-content');
  if (!container) return;

  container.innerHTML = `
    <div class="flex flex-col h-full">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4 shrink-0">
        <div>
          <h2 class="text-2xl font-headline font-bold text-on-surface tracking-tight">Users</h2>
          <p class="mt-1 text-[11px] font-semibold uppercase tracking-widest text-outline">Clients · Staff · Admins</p>
        </div>
        <button id="um-btn-invite"
          class="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5"
          style="background:var(--color-primary)">
          <span class="material-symbols-outlined text-[16px]">person_add</span> Invite Staff
        </button>
      </div>

      <div class="flex items-center gap-1 mb-5 bg-gray-100 rounded-2xl p-1 w-fit shrink-0">
        <button id="um-tab-clients" class="um-tab-btn px-5 py-2 rounded-xl text-sm font-bold transition-all bg-white shadow-sm text-on-surface">Clients</button>
        <button id="um-tab-staff"   class="um-tab-btn px-5 py-2 rounded-xl text-sm font-bold transition-all text-outline hover:text-on-surface">Staff &amp; Admins</button>
      </div>

      <div class="flex flex-wrap gap-3 mb-5 shrink-0">
        <select id="um-branch" class="bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-xl text-sm font-semibold focus:outline-none shadow-sm">
          <option value="all">All Branches</option>
          <option value="online">Online / Unassigned</option>
        </select>
        <div class="relative flex-1 min-w-[200px]">
          <input type="text" id="um-search" placeholder="Search name, email, ID number..."
            class="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none shadow-sm bg-white">
          <span class="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-[16px]">search</span>
        </div>
      </div>

      <div class="glass-card rounded-2xl flex flex-col overflow-hidden" style="min-height:300px">
        <div class="overflow-auto custom-scrollbar">
          <table class="min-w-full divide-y divide-slate-50">
            <thead class="bg-white sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
              <tr>
                <th class="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                <th class="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Match Key</th>
                <th class="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Branch</th>
                <th class="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance</th>
                <th class="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody id="um-body" class="bg-white divide-y divide-slate-50">
              <tr><td colspan="5" class="p-20 text-center text-slate-300 font-bold">Loading directory…</td></tr>
            </tbody>
          </table>
        </div>
        <div class="px-6 py-3 border-t border-slate-50 flex items-center justify-between">
          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registry <span id="um-count">0</span></div>
          <div id="um-pag"></div>
        </div>
      </div>
    </div>
  `;

  // ── scoped state ──────────────────────────────────────────────
  let umUsers = [], umBranches = [], umRoleFilter = 'client', umPage = 1;
  const PER_PAGE = 20;
  let umFiltered = [];

  const umIsStaff = r => ['admin', 'super_admin', 'base_admin'].includes(r);
  const umRoleLabel = r => ({ super_admin: 'SUPER ADMIN', admin: 'BRANCH MANAGER', base_admin: 'LOAN OFFICER' }[r] || 'CLIENT');
  const umValidID = id => {
    if (!id || !/^\d{13}$/.test(id)) return false;
    let s = 0;
    for (let i = 0; i < 12; i++) { let d = +id[i]; if (i%2) { d*=2; if(d>9) d-=9; } s+=d; }
    return (10 - s%10)%10 === +id[12];
  };

  const umRenderPage = () => {
    const tbody = document.getElementById('um-body');
    if (!tbody) return;
    const page = umFiltered.slice((umPage-1)*PER_PAGE, umPage*PER_PAGE);
    if (!page.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="p-20 text-center text-slate-300 font-bold">No results found.</td></tr>`;
    } else {
      tbody.innerHTML = page.map(u => {
        const branch = u.branches?.name || 'Online';
        const isClient = !umIsStaff(u.role);
        const idOk = isClient ? umValidID(u.identity_number || u.id_number) : null;
        return `
        <tr class="hover:bg-slate-50/50 transition-colors group cursor-pointer" onclick="window.location.href='/admin/users'">
          <td class="px-8 py-6">
            <div class="flex items-center gap-4">
              <div class="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xs font-black text-slate-400">${(u.full_name||'U').charAt(0)}</div>
              <div>
                <div class="text-sm font-black text-slate-900">${u.full_name||'Unknown'}</div>
                <div class="text-[9px] font-black text-slate-400 uppercase tracking-widest">${umRoleLabel(u.role)}</div>
              </div>
            </div>
          </td>
          <td class="px-6 py-6"><div class="text-[10px] font-black text-slate-500 font-mono tracking-tighter">${u.id.substring(0,13).toUpperCase()}</div></td>
          <td class="px-6 py-6"><span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">${branch}</span></td>
          <td class="px-6 py-6">
            ${idOk===null?'':`<div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full ${idOk?'bg-emerald-500':'bg-red-500'}"></span>
              <span class="text-[10px] font-black uppercase tracking-widest ${idOk?'text-emerald-600':'text-red-600'}">${idOk?'ID Valid':'ID Invalid'}</span>
            </div>`}
          </td>
          <td class="px-8 py-6 text-right">
            <button class="w-10 h-10 flex items-center justify-center text-slate-300 group-hover:text-[#a04100] transition-colors ml-auto">
              <span class="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
          </td>
        </tr>`;
      }).join('');
    }
    const countEl = document.getElementById('um-count');
    if (countEl) countEl.textContent = umFiltered.length;
    const total = Math.ceil(umFiltered.length/PER_PAGE)||1;
    const pag = document.getElementById('um-pag');
    if (pag) pag.innerHTML = total<=1?'':`
      <div class="flex gap-2">
        <button onclick="window._umPrev()" ${umPage===1?'disabled':''} class="px-3 py-1.5 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 shadow-sm">Prev</button>
        <span class="text-xs font-bold text-gray-500 self-center">${umPage}/${total}</span>
        <button onclick="window._umNext()" ${umPage===total?'disabled':''} class="px-3 py-1.5 text-xs font-bold border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 shadow-sm">Next</button>
      </div>`;
    window._umPrev = () => { umPage--; umRenderPage(); };
    window._umNext = () => { umPage++; umRenderPage(); };
  };

  const umApply = (reset=true) => {
    if (reset) umPage = 1;
    const term = (document.getElementById('um-search')?.value||'').toLowerCase();
    const branch = document.getElementById('um-branch')?.value||'all';
    umFiltered = umUsers.filter(u => {
      const text = !term || (u.full_name||'').toLowerCase().includes(term) || (u.email||'').toLowerCase().includes(term) || (u.identity_number||'').includes(term) || (u.id||'').includes(term);
      const role = umRoleFilter==='staff' ? umIsStaff(u.role) : !umIsStaff(u.role);
      const br = branch==='all' || u.branch_id?.toString()===branch || (branch==='online'&&!u.branch_id);
      return text && role && br;
    });
    umRenderPage();
  };

  const umSwitchTab = tab => {
    umRoleFilter = tab==='staff'?'staff':'client';
    document.querySelectorAll('.um-tab-btn').forEach(b => {
      const on = b.id===`um-tab-${tab}`;
      b.classList.toggle('bg-white',on); b.classList.toggle('shadow-sm',on);
      b.classList.toggle('text-on-surface',on); b.classList.toggle('text-outline',!on);
    });
    umApply(true);
  };

  // ── invite staff modal ────────────────────────────────────────
  const umInjectInvite = (branches) => {
    if (document.getElementById('um-invite-modal')) return;
    const m = document.createElement('div');
    m.id = 'um-invite-modal';
    m.className = 'hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4';
    m.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between mb-6">
          <div><h3 class="text-lg font-bold text-gray-900">Invite Staff Member</h3>
          <p class="text-xs text-gray-500 mt-0.5">Creates a login account and profile immediately.</p></div>
          <button onclick="document.getElementById('um-invite-modal').classList.add('hidden')"
            class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500">
            <span class="material-symbols-outlined text-[16px]">close</span></button>
        </div>
        <div id="um-invite-err" class="hidden mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium"></div>
        <div id="um-invite-ok"  class="hidden mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium"></div>
        <form id="um-invite-form" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Full Name *</label>
            <input name="full_name" type="text" required placeholder="Jane Smith"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Email Address *</label>
            <input name="email" type="email" required placeholder="jane@company.co.za"
              class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none">
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Role *</label>
              <select name="role" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                <option value="base_admin">Loan Officer</option>
                <option value="admin">Branch Manager</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1">Branch</label>
              <select name="branch_id" class="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-400 outline-none bg-white">
                <option value="">No branch</option>
                ${branches.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" onclick="document.getElementById('um-invite-modal').classList.add('hidden')"
              class="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
            <button type="submit" id="um-invite-submit"
              class="px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm" style="background:var(--color-primary)">Send Invite</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(m);

    document.getElementById('um-invite-form').addEventListener('submit', async e => {
      e.preventDefault();
      const btn = document.getElementById('um-invite-submit');
      const errEl = document.getElementById('um-invite-err');
      const okEl  = document.getElementById('um-invite-ok');
      errEl.classList.add('hidden'); okEl.classList.add('hidden');
      btn.disabled = true; btn.textContent = 'Sending…';
      const fd = new FormData(e.target);
      try {
        const res = await apiFetch('/api/admin/invite-staff', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ full_name: fd.get('full_name'), email: fd.get('email'), role: fd.get('role'), branch_id: fd.get('branch_id')||null }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error||'Invite failed');
        okEl.textContent = `Invite sent to ${fd.get('email')}`;
        okEl.classList.remove('hidden');
        e.target.reset();
        setTimeout(()=>document.getElementById('um-invite-modal')?.classList.add('hidden'), 2000);
      } catch(err) {
        errEl.textContent = err.message; errEl.classList.remove('hidden');
      } finally { btn.disabled=false; btn.textContent='Send Invite'; }
    });
  };

  // ── load data ─────────────────────────────────────────────────
  try {
    const [usersData, branchRes] = await Promise.all([fetchUsers(), fetchBranches()]);
    umUsers   = usersData || [];
    umBranches = branchRes?.data || [];

    const branchSel = document.getElementById('um-branch');
    umBranches.forEach(b => branchSel?.insertAdjacentHTML('beforeend', `<option value="${b.id}">${b.name}</option>`));

    document.getElementById('um-search')?.addEventListener('input', ()=>umApply(true));
    document.getElementById('um-branch')?.addEventListener('change', ()=>umApply(true));
    document.getElementById('um-tab-clients')?.addEventListener('click', ()=>umSwitchTab('clients'));
    document.getElementById('um-tab-staff')?.addEventListener('click',   ()=>umSwitchTab('staff'));
    document.getElementById('um-btn-invite')?.addEventListener('click', ()=>document.getElementById('um-invite-modal')?.classList.remove('hidden'));

    umInjectInvite(umBranches);
    umSwitchTab('clients');
  } catch (err) {
    console.error(err);
    const tbody = document.getElementById('um-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Failed to load: ${err.message}</td></tr>`;
  }
}

function renderUserTable() {
    const tbody = document.getElementById('users-table-body');
    const countEl = document.getElementById('user-count');
    if (!tbody) return;
    if (countEl) countEl.textContent = `Showing ${filteredUsers.length} users`;
    if (filteredUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-8 text-center text-sm text-gray-500">No users found.</td></tr>`;
        return;
    }
    tbody.innerHTML = filteredUsers.map(user => {
        const shortId = user.id.substring(0, 6) + '...';
        return `
        <tr class="hover:bg-gray-50 transition-colors group">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    ${renderAvatar(user)}
                    <div>
                        <div class="text-sm font-bold text-gray-900">${user.full_name || 'Unknown'}</div>
                        <div class="text-xs text-gray-500">${user.email || 'No email'}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs font-mono text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block border border-gray-100" title="Full UUID: ${user.id}">
                    ${shortId}
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRoleBadge(user.role)}">${getRoleLabel(user.role)}</span>
            </td>
            <td class="px-6 py-4 text-right">
                ${user.id !== currentUserProfile.id ? `
                <button onclick="window.openRoleModal('${user.id}', '${user.full_name?.replace(/'/g, "\\'") || ''}', '${user.role}')"
                    class="text-on-surface-variant font-semibold text-xs bg-surface-container border border-outline-variant/30 px-3 py-1.5 rounded-xl transition-colors inline-flex items-center gap-2" title="Change Role">
                    <span class="material-symbols-outlined text-[14px]">manage_accounts</span> Change Role
                </button>` : `<span class="text-xs text-gray-300 italic pr-2">Current User</span>`}
            </td>
        </tr>
    `}).join('');
}

window.openRoleModal = (id, name, role) => {
    document.getElementById('modal-user-id').value = id;
    document.getElementById('modal-user-name').textContent = name;
    document.getElementById('modal-current-role').textContent = getRoleLabel(role);
    document.getElementById('modal-role-select').value = role;
    document.getElementById('role-modal').classList.remove('hidden');
};

async function renderBillingTab() {
    const container = document.getElementById('tab-content');
    container.innerHTML = `
        <div class="max-w-4xl animate-fade-in">
            <h2 class="text-2xl font-headline font-bold text-on-surface mb-1">Billing & Payments</h2>
            <p class="text-[11px] font-semibold uppercase tracking-widest text-outline mb-8">Manage disbursement methods.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="glass-card p-8 rounded-2xl">
                    <h3 class="font-bold text-gray-800 mb-4">Add Payment Method</h3>
                    <form id="card-form" class="space-y-4">
                        <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Card Type</label><select id="card-type" class="w-full border-gray-300 rounded-lg text-sm p-2.5"><option value="visa">Visa</option><option value="mastercard">Mastercard</option></select></div>
                        <div><label class="block text-xs font-bold text-gray-500 uppercase mb-1">Last 4 Digits</label><input type="text" id="card-last4" maxlength="4" class="w-full border-gray-300 rounded-lg text-sm p-2.5" placeholder="1234"></div>
                        <div class="grid grid-cols-2 gap-4"><input type="text" id="card-mm" maxlength="2" placeholder="MM" class="w-full border-gray-300 rounded-lg text-sm p-2.5"><input type="text" id="card-yy" maxlength="4" placeholder="YYYY" class="w-full border-gray-300 rounded-lg text-sm p-2.5"></div>
                        <button type="submit" class="w-full py-2.5 rounded-xl font-semibold text-sm text-white mt-2" style="background:var(--color-primary)">Add Card</button>
                    </form>
                </div>
                <div class="bg-surface-container p-8 rounded-2xl border border-outline-variant/20">
                    <h3 class="font-bold text-gray-800 mb-4">Saved Cards</h3>
                    <div id="cards-list" class="space-y-3"><p class="text-sm text-gray-400 italic">Loading...</p></div>
                </div>
            </div>
        </div>
    `;
    const loadCards = async () => {
        const { data } = await getPaymentMethods();
        const list = document.getElementById('cards-list');
        if(!data || data.length === 0) { list.innerHTML = `<p class="text-sm text-gray-400 italic">No cards saved.</p>`; return; }
        list.innerHTML = data.map(c => `
            <div class="flex items-center gap-3 p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
                <span class="material-symbols-outlined text-outline">credit_card</span>
                <div class="flex-1"><p class="text-sm font-bold text-on-surface">•••• ${c.last_four}</p><p class="text-xs text-outline">Exp: ${c.expiry_month}/${c.expiry_year}</p></div>
                ${c.is_default ? '<span class="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold uppercase">Default</span>' : ''}
            </div>
        `).join('');
    };
    loadCards();
    document.getElementById('card-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const cardData = { p_card_type: document.getElementById('card-type').value, p_last_four: document.getElementById('card-last4').value, p_expiry_month: document.getElementById('card-mm').value, p_expiry_year: document.getElementById('card-yy').value };
        const { error } = await addPaymentMethod(cardData);
        if(error) showToast(error.message, 'error'); else { showToast('Card Added', 'success'); e.target.reset(); loadCards(); }
    });
}

// --- TAB: System Settings (Updated with URL Inputs) ---
async function renderSystemSettingsTab() {
    const container = document.getElementById('tab-content');
    if (!container) return;

    try {
        const { data } = await fetchSystemSettings();
        if (data) {
            systemSettings = cloneSystemSettings(data);
            systemSettingsDraft = cloneSystemSettings(data);
        }
    } catch(e) { console.error("Settings Sync Error:", e); }

    const currentLogo = systemSettingsDraft.company_logo_url || '';
    const currentWallpaper = systemSettingsDraft.auth_background_url || '';
    const companyNameAttr = escapeHtmlAttr(normalizeCompanyName(systemSettingsDraft.company_name));
    const overlayColor = normalizeHex(systemSettingsDraft.auth_overlay_color) || DEFAULT_SYSTEM_SETTINGS.auth_overlay_color;
    const overlayDisabledChecked = !normalizeBooleanSetting(systemSettingsDraft.auth_overlay_enabled, true);
    const wallpaperFlipChecked = normalizeBooleanSetting(systemSettingsDraft.auth_background_flip, false);
    const carouselSlides = getCarouselSlidesDraft();

    container.innerHTML = `
        <div class="max-w-5xl space-y-8 animate-fade-in">
            <div class="flex items-center justify-between">
                <div><h2 class="text-2xl font-headline font-bold text-on-surface">System Branding</h2><p class="text-[11px] font-semibold uppercase tracking-widest text-outline mt-0.5">Customize the look and feel of the platform.</p></div>
                <div class="text-right">
                    <button id="save-system-settings" class="px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed" style="background:var(--color-primary)">Save Changes</button>
                    <p id="system-settings-status" class="text-xs text-gray-400 mt-2 font-medium">No pending changes</p>
                </div>
            </div>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Company Identity</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Name</label>
                        <input type="text" id="company-name-input" value="${companyNameAttr}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Logo</label>
                        <div class="flex flex-col lg:flex-row gap-4">
                            <div class="h-20 w-20 bg-surface-container rounded-xl border border-outline-variant/20 flex items-center justify-center overflow-hidden shrink-0">
                                ${currentLogo ? `<img src="${currentLogo}" class="h-full w-full object-contain">` : `<span class="material-symbols-outlined text-outline text-3xl">image</span>`}
                            </div>
                            <div class="space-y-3 flex-1">
                                <div class="flex gap-2">
                                    <label class="cursor-pointer px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 text-center">
                                        Upload File <input type="file" id="logo-file-input" class="hidden" accept="image/*">
                                    </label>
                                    ${currentLogo ? `<button id="remove-logo-btn" class="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Remove</button>` : ''}
                                </div>
                                <div class="flex gap-2">
                                    <input type="url" id="logo-url-input" value="${currentLogo}" class="flex-1 border-gray-300 rounded-lg p-1.5 text-xs focus:ring-orange-500" placeholder="https://...">
                                    <button id="apply-logo-url" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200">Use Link</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Company Legal Details</h4>
                <p class="text-xs text-gray-400 mb-4">These details appear in loan contracts and NCA disclosures.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="md:col-span-2">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Legal Entity Name (Pty Ltd)</label>
                        <input type="text" id="legal-entity-name-input" value="${escapeHtmlAttr(systemSettingsDraft.legal_entity_name || '')}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="AlgoLend (Pty) Ltd">
                        <p class="text-xs text-gray-400 mt-1">Appears on login page and contracts: "{Legal Entity} t/a {Trading Name}".</p>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">NCR Registration Number</label>
                        <input type="text" id="ncr-number-input" value="${escapeHtmlAttr(systemSettingsDraft.ncr_number || '')}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="NCRCP12345">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">FSP Number</label>
                        <input type="text" id="fsp-number-input" value="${escapeHtmlAttr(systemSettingsDraft.fsp_number || '')}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="12345">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Registration Number</label>
                        <input type="text" id="company-reg-input" value="${escapeHtmlAttr(systemSettingsDraft.company_reg_number || '')}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="2023/123456/07">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">VAT Number</label>
                        <input type="text" id="company-vat-input" value="${escapeHtmlAttr(systemSettingsDraft.company_vat_number || '')}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="4012345678">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Branch Code (for contracts)</label>
                        <input type="text" id="provider-branch-code-input" value="${escapeHtmlAttr(systemSettingsDraft.provider_branch_code || '')}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="ZFS">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Company Phone</label>
                        <input type="text" id="company-phone-input" value="${escapeHtmlAttr(systemSettingsDraft.company_phone || '')}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="0691195046">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Physical Address</label>
                        <input type="text" id="company-physical-address-input" value="${escapeHtmlAttr(systemSettingsDraft.company_physical_address || '')}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="123 Main Street, Johannesburg, 2001">
                    </div>
                    <div class="md:col-span-2">
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Postal Address</label>
                        <input type="text" id="company-postal-address-input" value="${escapeHtmlAttr(systemSettingsDraft.company_postal_address || '')}" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="PO Box 1234, Johannesburg, 2001">
                    </div>
                </div>
            </section>

            <!-- ── NCR Reporting ─────────────────────────────────────── -->
            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-1 border-b border-outline-variant/10 pb-2 flex items-center gap-2">
                    <span class="material-symbols-outlined text-[20px]" style="color:var(--color-primary)">assignment</span>
                    NCR Statutory Reporting
                </h4>
                <p class="text-xs text-gray-400 mb-4">Controls period generation on the NCR Reporting screen (Form 39 &amp; Form 40).</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Form 39 Submission Frequency</label>
                        <select id="ncr-frequency-input" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                            <option value="annually" ${(systemSettingsDraft.ncr_submission_frequency || 'annually') === 'annually' ? 'selected' : ''}>Annually (smaller provider — due 15 Feb)</option>
                            <option value="quarterly" ${(systemSettingsDraft.ncr_submission_frequency || '') === 'quarterly' ? 'selected' : ''}>Quarterly (larger provider — Q1–Q4)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Financial Year-End Month (for Form 40)</label>
                        <select id="ncr-year-end-input" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500">
                            ${['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => `<option value="${i+1}" ${Number(systemSettingsDraft.ncr_financial_year_end_month || 12) === i+1 ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                        <p class="text-xs text-gray-400 mt-1">Form 40 is due 6 months after this month.</p>
                    </div>
                </div>
            </section>

            <!-- ── Banking Details ───────────────────────────────────── -->
            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-1 border-b border-outline-variant/10 pb-2 flex items-center gap-2">
                    <span class="material-symbols-outlined text-[20px]" style="color:var(--color-primary)">account_balance</span>
                    Company Banking Details
                </h4>
                <p class="text-xs text-gray-400 mb-5">Displayed to clients when they make a manual EFT payment or settle a loan.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Bank Name</label>
                        <input type="text" id="bank-name-input" value="${escapeHtmlAttr(systemSettingsDraft.company_bank_name || '')}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. FNB, ABSA, Standard Bank">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Account Holder Name</label>
                        <input type="text" id="bank-holder-input" value="${escapeHtmlAttr(systemSettingsDraft.company_bank_account_holder || '')}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. AlgoLend">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Account Number</label>
                        <input type="text" id="bank-account-no-input" value="${escapeHtmlAttr(systemSettingsDraft.company_bank_account_no || '')}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm font-mono focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. 62812345678">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Branch Code</label>
                        <input type="text" id="bank-branch-code-input" value="${escapeHtmlAttr(systemSettingsDraft.company_bank_branch_code || '')}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm font-mono focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. 250655">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Account Type</label>
                        <select id="bank-account-type-input" class="w-full border-gray-300 rounded-lg p-2.5 text-sm focus:ring-orange-500 focus:border-orange-500 bg-white">
                            <option value="current"  ${(systemSettingsDraft.company_bank_account_type||'current')==='current'  ? 'selected':''}>Current / Cheque</option>
                            <option value="savings"  ${(systemSettingsDraft.company_bank_account_type||'')==='savings'  ? 'selected':''}>Savings</option>
                            <option value="business" ${(systemSettingsDraft.company_bank_account_type||'')==='business' ? 'selected':''}>Business</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Reference Prefix</label>
                        <input type="text" id="bank-ref-prefix-input" value="${escapeHtmlAttr(systemSettingsDraft.company_bank_reference_prefix || 'REF')}"
                            class="w-full border-gray-300 rounded-lg p-2.5 text-sm font-mono focus:ring-orange-500 focus:border-orange-500" placeholder="e.g. ZFS">
                        <p class="text-xs text-gray-400 mt-1">Client reference = PREFIX-LOANID (e.g. ZFS-1001)</p>
                    </div>
                </div>

                <!-- Live preview -->
                <div class="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Client will see:</p>
                    <div class="grid grid-cols-2 gap-y-1 text-sm">
                        ${[
                            ['Bank', systemSettingsDraft.company_bank_name || '—'],
                            ['Account Holder', systemSettingsDraft.company_bank_account_holder || systemSettingsDraft.company_name || '—'],
                            ['Account Number', systemSettingsDraft.company_bank_account_no || '—'],
                            ['Branch Code', systemSettingsDraft.company_bank_branch_code || '—'],
                            ['Account Type', systemSettingsDraft.company_bank_account_type || 'current'],
                            ['Reference', `${systemSettingsDraft.company_bank_reference_prefix||'REF'}-LOANID`]
                        ].map(([k,v]) => `
                            <span class="text-gray-400 text-xs">${k}</span>
                            <span class="font-semibold text-gray-800 text-xs">${v}</span>
                        `).join('')}
                    </div>
                </div>
            </section>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Theme Colors</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${COLOR_FIELDS.map(f => `
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">${f.label}</label>
                            <div class="flex items-center gap-2">
                                <input type="color" data-color-picker="${f.key}" value="${systemSettingsDraft[f.key]}" class="h-10 w-10 rounded cursor-pointer border border-gray-300 p-0 overflow-hidden">
                                <input type="text" data-color-input="${f.key}" value="${systemSettingsDraft[f.key]}" class="flex-1 border-gray-300 rounded-lg p-2 text-sm font-mono uppercase focus:ring-orange-500">
                            </div>
                        </div>`).join('')}
                </div>
                <div class="mt-6 p-4 bg-surface-container rounded-xl border border-outline-variant/20 flex items-center gap-4">
                    <span class="text-xs font-bold text-gray-500 uppercase">Preview:</span>
                    <div id="brand-gradient-preview" class="flex-1 h-8 rounded-lg shadow-inner" style="background: linear-gradient(90deg, ${systemSettingsDraft.primary_color}, ${systemSettingsDraft.secondary_color}, ${systemSettingsDraft.tertiary_color})"></div>
                </div>
            </section>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Login Styling</h4>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase mb-2">Wallpaper</label>
                        <div id="auth-bg-preview" class="h-40 rounded-xl border border-gray-300 bg-gray-100 flex items-center justify-center relative overflow-hidden bg-cover bg-center mb-3" style="background-image: ${currentWallpaper ? `url('${currentWallpaper}')` : 'none'}; transform: scaleX(${wallpaperFlipChecked ? '-1' : '1'});">
                             ${!currentWallpaper ? '<span class="text-xs text-gray-400 font-bold">Default</span>' : ''}
                        </div>
                        <div class="space-y-3">
                            <div class="flex gap-2">
                                <label class="cursor-pointer px-4 py-2.5 rounded-xl text-xs font-semibold text-white" style="background:var(--color-primary)">
                                    <span class="material-symbols-outlined text-[14px] align-middle mr-1">cloud_upload</span> Upload
                                    <input type="file" id="wallpaper-file-input" class="hidden" accept="image/*">
                                </label>
                                ${currentWallpaper ? `<button id="remove-wallpaper-btn" class="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100">Remove</button>` : ''}
                            </div>
                            <div class="flex gap-2">
                                <input type="url" id="wallpaper-url-input" value="${currentWallpaper}" class="flex-1 border-gray-300 rounded-lg p-1.5 text-xs focus:ring-orange-500" placeholder="https://...">
                                <button id="apply-wallpaper-url" class="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200">Use Link</button>
                            </div>
                            <label class="flex items-center gap-2 cursor-pointer pt-2">
                                <input type="checkbox" id="wallpaper-flip-toggle" class="rounded text-orange-600" ${wallpaperFlipChecked ? 'checked' : ''}>
                                <span class="text-xs font-medium text-gray-700">Flip Horizontal</span>
                            </label>
                        </div>
                    </div>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Overlay Tint</label>
                            <div class="flex items-center gap-2">
                                <input type="color" id="overlay-color-picker" value="${overlayColor}" class="h-10 w-10 rounded border border-gray-300 cursor-pointer">
                                <input type="text" id="overlay-color-input" value="${overlayColor}" class="w-32 border-gray-300 rounded-lg p-2 text-sm font-mono uppercase">
                            </div>
                        </div>
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="overlay-disable-toggle" class="rounded text-orange-600" ${overlayDisabledChecked ? 'checked' : ''}>
                            <span class="text-sm font-medium text-gray-700">Disable Overlay</span>
                        </label>
                    </div>
                </div>
            </section>

            <section class="glass-card p-8 rounded-2xl">
                <h4 class="text-lg font-headline font-bold text-on-surface mb-4 border-b border-outline-variant/10 pb-2">Login Text</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    ${carouselSlides.map((slide, i) => `
                        <div class="space-y-2 p-3 bg-surface-container rounded-xl border border-outline-variant/10">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Slide ${i + 1}</span>
                            <input type="text" value="${escapeHtmlAttr(slide.title)}" data-carousel-index="${i}" data-carousel-field="title" class="w-full border-gray-300 rounded-lg text-sm font-bold p-2 focus:ring-orange-500" placeholder="Title">
                            <textarea rows="3" data-carousel-index="${i}" data-carousel-field="text" class="w-full border-gray-300 rounded-lg text-xs p-2 focus:ring-orange-500 resize-none" placeholder="Description">${escapeHtmlContent(slide.text)}</textarea>
                        </div>
                    `).join('')}
                </div>
            </section>
        </div>
    `;

    // --- Listeners ---
    COLOR_FIELDS.forEach(({ key }) => {
        document.querySelector(`[data-color-picker="${key}"]`)?.addEventListener('input', (e) => {
            const val = normalizeHex(e.target.value);
            if (val) commitThemeDraft({ [key]: val });
        });
        document.querySelector(`[data-color-input="${key}"]`)?.addEventListener('change', (e) => {
            const val = normalizeHex(e.target.value);
            if (val) commitThemeDraft({ [key]: val });
        });
    });

    document.getElementById('company-name-input')?.addEventListener('input', (e) => commitThemeDraft({ company_name: e.target.value }));
    document.getElementById('ncr-number-input')?.addEventListener('input',          (e) => commitThemeDraft({ ncr_number: e.target.value }));
    document.getElementById('fsp-number-input')?.addEventListener('input',          (e) => commitThemeDraft({ fsp_number: e.target.value }));
    document.getElementById('legal-entity-name-input')?.addEventListener('input',  (e) => commitThemeDraft({ legal_entity_name: e.target.value }));
    document.getElementById('company-reg-input')?.addEventListener('input',         (e) => commitThemeDraft({ company_reg_number: e.target.value }));
    document.getElementById('company-vat-input')?.addEventListener('input', (e) => commitThemeDraft({ company_vat_number: e.target.value }));
    document.getElementById('provider-branch-code-input')?.addEventListener('input', (e) => commitThemeDraft({ provider_branch_code: e.target.value }));
    document.getElementById('company-phone-input')?.addEventListener('input', (e) => commitThemeDraft({ company_phone: e.target.value }));
    document.getElementById('company-physical-address-input')?.addEventListener('input', (e) => commitThemeDraft({ company_physical_address: e.target.value }));
    document.getElementById('company-postal-address-input')?.addEventListener('input',  (e) => commitThemeDraft({ company_postal_address: e.target.value }));
    // Banking details
    document.getElementById('bank-name-input')?.addEventListener('input',         (e) => commitThemeDraft({ company_bank_name: e.target.value }));
    document.getElementById('bank-holder-input')?.addEventListener('input',       (e) => commitThemeDraft({ company_bank_account_holder: e.target.value }));
    document.getElementById('bank-account-no-input')?.addEventListener('input',   (e) => commitThemeDraft({ company_bank_account_no: e.target.value }));
    document.getElementById('bank-branch-code-input')?.addEventListener('input',  (e) => commitThemeDraft({ company_bank_branch_code: e.target.value }));
    document.getElementById('bank-account-type-input')?.addEventListener('change',(e) => commitThemeDraft({ company_bank_account_type: e.target.value }));
    document.getElementById('bank-ref-prefix-input')?.addEventListener('input',   (e) => commitThemeDraft({ company_bank_reference_prefix: e.target.value }));
    document.getElementById('ncr-frequency-input')?.addEventListener('change',    (e) => commitThemeDraft({ ncr_submission_frequency: e.target.value }));
    document.getElementById('ncr-year-end-input')?.addEventListener('change',     (e) => commitThemeDraft({ ncr_financial_year_end_month: Number(e.target.value) }));
    document.getElementById('wallpaper-flip-toggle')?.addEventListener('change', (e) => commitThemeDraft({ auth_background_flip: e.target.checked }));
    document.getElementById('overlay-disable-toggle')?.addEventListener('change', (e) => commitThemeDraft({ auth_overlay_enabled: !e.target.checked }));
    document.getElementById('overlay-color-picker')?.addEventListener('input', (e) => {
        const val = normalizeHex(e.target.value);
        if(val) commitThemeDraft({ auth_overlay_color: val });
    });

    document.querySelectorAll('[data-carousel-field]').forEach(el => {
        el.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.carouselIndex);
            const field = e.target.dataset.carouselField;
            const slides = [...getCarouselSlidesDraft()];
            slides[idx] = { ...slides[idx], [field]: e.target.value };
            commitThemeDraft({ carousel_slides: slides });
        });
    });

    document.getElementById('save-system-settings')?.addEventListener('click', async () => {
        if(isSavingTheme) return;
        isSavingTheme = true;
        updateThemeSaveState();
        const { data, error } = await updateSystemSettings(systemSettingsDraft);
        if(error) { showToast("Failed to save: " + error, "error"); } 
        else {
            showToast("System settings saved!", "success");
            systemSettings = cloneSystemSettings(data);
            systemSettingsDraft = cloneSystemSettings(data);
            themeHasPendingChanges = false;
            persistTheme(systemSettings);
        }
        isSavingTheme = false;
        updateThemeSaveState();
    });

    // Upload & URL Handlers
    document.getElementById('logo-file-input')?.addEventListener('change', handleLogoUpload);
    document.getElementById('remove-logo-btn')?.addEventListener('click', () => {
        commitThemeDraft({ company_logo_url: null });
        showToast("Logo removed (pending save).", "success");
    });
    document.getElementById('apply-logo-url')?.addEventListener('click', () => {
        const url = document.getElementById('logo-url-input').value.trim();
        if(url) {
            commitThemeDraft({ company_logo_url: url });
            showToast("Logo link applied. Save to confirm.", "success");
        }
    });

    document.getElementById('wallpaper-file-input')?.addEventListener('change', handleWallpaperUpload);
    document.getElementById('remove-wallpaper-btn')?.addEventListener('click', () => {
        commitThemeDraft({ auth_background_url: null });
        showToast("Wallpaper removed (pending save).", "success");
    });
    document.getElementById('apply-wallpaper-url')?.addEventListener('click', () => {
        const url = document.getElementById('wallpaper-url-input').value.trim();
        if(url) {
            commitThemeDraft({ auth_background_url: url });
            showToast("Wallpaper link applied. Save to confirm.", "success");
        }
    });

    updateThemeSaveState();
}

async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    try {
        const fileExt = file.name.split('.').pop();
        const path = `system/logo_${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('avatars').upload(path, file);
        if(error) throw error;
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        commitThemeDraft({ company_logo_url: data.publicUrl });
        showToast("Logo uploaded successfully!", "success");
    } catch(err) { showToast("Upload failed: " + err.message, "error"); }
}

async function handleWallpaperUpload(e) {
    const file = e.target.files[0];
    if(!file) return;
    try {
        const fileExt = file.name.split('.').pop();
        const path = `system/wallpaper_${Date.now()}.${fileExt}`;
        const { error } = await supabase.storage.from('avatars').upload(path, file);
        if(error) throw error;
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        commitThemeDraft({ auth_background_url: data.publicUrl });
        showToast("Wallpaper uploaded successfully!", "success");
    } catch(err) { showToast("Upload failed: " + err.message, "error"); }
}

// --- Initialization ---
async function loadSystemSettingsState() {
    try {
        const { data } = await fetchSystemSettings();
        if (data) {
            systemSettings = cloneSystemSettings(data);
            systemSettingsDraft = cloneSystemSettings(data);
            persistTheme(systemSettings);
        }
    } catch (e) { console.error("Init Settings Error:", e); }
}

document.addEventListener('DOMContentLoaded', async () => {
  const authInfo = await initLayout();
  if (!authInfo) return; 
  userRole = authInfo.role; 
  currentUserProfile = authInfo.profile; 
  
  if (userRole === 'super_admin') {
    await loadSystemSettingsState();
  } else {
    await ensureThemeLoaded();
    const cached = getCachedTheme();
    if (cached) {
      const normalized = cloneSystemSettings(cached);
      systemSettings = normalized;
      systemSettingsDraft = cloneSystemSettings(normalized);
    }
  }
  renderPageContent();
});