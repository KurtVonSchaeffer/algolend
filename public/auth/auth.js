import { supabase } from '../Services/supabaseClient.js';
import { ensureThemeLoaded, getCachedTheme, DEFAULT_SYSTEM_SETTINGS, getCompanyName } from '../shared/theme-runtime.js';

const authContainer = document.getElementById('auth-container');

// State Management
let viewState = 'login'; // Options: 'login', 'signup', 'forgot'
let formMessage = { type: '', text: '' }; 
let brandingTheme = null;

const DEFAULT_BRAND_LOGO = 'https://placehold.co/240x80?text=Your+Logo';
const DEFAULT_AUTH_WALLPAPER = 'https://static.wixstatic.com/media/f82622_a05fcfc8600d48818feb2feeef4796fa~mv2.png';
const DEFAULT_AUTH_OVERLAY_COLOR = DEFAULT_SYSTEM_SETTINGS.auth_overlay_color || '#212121ff';
const DEFAULT_AUTH_OVERLAY_ENABLED = DEFAULT_SYSTEM_SETTINGS.auth_overlay_enabled !== false;
const DEFAULT_CAROUSEL_SLIDES = (DEFAULT_SYSTEM_SETTINGS.carousel_slides || []).map((slide) => ({
    title: slide?.title || '',
    text: slide?.text || ''
}));

const escapeAttr = (value = '') => {
    const str = `${value || ''}`;
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

const escapeHtml = (value = '') => `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const getActiveCompanyName = () => getCompanyName(brandingTheme || getCachedTheme() || DEFAULT_SYSTEM_SETTINGS);

const sanitizeCarouselSlides = (slides) => {
    const fallback = DEFAULT_CAROUSEL_SLIDES;
    const incoming = Array.isArray(slides) && slides.length ? slides : fallback;
    return fallback.map((fallbackSlide, index) => {
        const candidate = incoming[index] || {};
        const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
        const text = typeof candidate.text === 'string' ? candidate.text.trim() : '';
        return {
            title: title || fallbackSlide.title,
            text: text || fallbackSlide.text
        };
    });
};

const normalizeHexColor = (value, fallback) => {
    if (!value) return fallback;
    let hex = `${value}`.trim().replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map((char) => char + char).join('');
    }
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        return fallback;
    }
    return `#${hex.toUpperCase()}`;
};

let carouselSlides = sanitizeCarouselSlides();
let currentSlideIndex = 0;
let carouselInterval;

const ADMIN_ROLE_LEVELS = {
    borrower: 0,
    user: 0,
    support: 1,
    admin: 2,
    base_admin: 2,
    super_admin: 3,
    owner: 4
};

const hasMinimumRole = (role, minimumRole = 'base_admin') => {
    const normalizedRole = String(role || '').trim().toLowerCase();
    const normalizedMinimum = String(minimumRole || 'base_admin').trim().toLowerCase();
    const roleLevel = ADMIN_ROLE_LEVELS[normalizedRole] ?? 0;
    const minimumLevel = ADMIN_ROLE_LEVELS[normalizedMinimum] ?? 2;
    return roleLevel >= minimumLevel;
};

async function resolveAdminAccess(session, minimumRole = 'base_admin') {
    // Primary: read role from JWT app_metadata (set by Supabase auth hooks)
    const jwtRole = session?.user?.app_metadata?.role
        || session?.user?.user_metadata?.role
        || '';
    if (jwtRole && hasMinimumRole(jwtRole, minimumRole)) {
        return true;
    }

    // Fallback: try the RPC (in case roles ever live in DB)
    const { data: rpcAllowed, error: rpcError } = await supabase.rpc('is_role_or_higher', {
        p_min_role: minimumRole
    });

    if (!rpcError) {
        return Boolean(rpcAllowed);
    }

    console.warn('Role RPC unavailable, JWT role insufficient:', jwtRole || '(none)');
    return false;
}

async function ensureBrandingTheme(force = false) {
    try {
        const theme = await ensureThemeLoaded({ force });
        brandingTheme = theme;
        carouselSlides = sanitizeCarouselSlides(theme?.carousel_slides);
        currentSlideIndex = 0;
        return theme;
    } catch (error) {
        console.warn('Auth theme load failed:', error);
        const cached = getCachedTheme();
        if (cached) {
            brandingTheme = cached;
            carouselSlides = sanitizeCarouselSlides(cached.carousel_slides);
            currentSlideIndex = 0;
        }
        return brandingTheme;
    }
}

// ============================================
// AUTH GUARD
// ============================================
async function checkSession() {
    const withTimeout = (promise, ms = 7000) => {
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Auth request timed out after ${ms}ms`)), ms);
        });
        return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
    };

    try {
        // Theme fetch with timeout — don't let it block login
        try {
            await withTimeout(ensureBrandingTheme(), 5000);
        } catch (themeErr) {
            console.warn('Theme load timed out or failed, continuing with defaults:', themeErr.message);
        }

        const { data: { session } } = await withTimeout(supabase.auth.getSession(), 7000);

        if (!session) {
            render();
            return;
        }

        const isAllowed = await withTimeout(resolveAdminAccess(session, 'base_admin'), 7000);

        if (isAllowed) {
            window.location.replace('/admin/dashboard');
        } else {
            window.location.replace('/user-portal/index.html');
        }
    } catch (error) {
        console.error('Auth bootstrap failed:', error);
        try {
            await supabase.auth.signOut();
        } catch (_) { /* ignore */ }
        render();
    }
}

// ============================================
// CAROUSEL LOGIC
// ============================================
function startCarousel() {
    if (carouselInterval) clearInterval(carouselInterval);
    
    const titleEl = document.getElementById('carousel-title');
    const textEl = document.getElementById('carousel-text');
    const dotsContainer = document.getElementById('carousel-dots');

    if (!titleEl || !textEl || !dotsContainer) return;

    const getSlides = () => (carouselSlides.length ? carouselSlides : DEFAULT_CAROUSEL_SLIDES);
    const totalSlides = getSlides().length;

    const updateSlide = (index) => {
        titleEl.style.opacity = '0';
        textEl.style.opacity = '0';
        
        setTimeout(() => {
            const activeSlides = getSlides();
            const safeIndex = index % activeSlides.length;
            titleEl.innerText = activeSlides[safeIndex].title;
            textEl.innerText = activeSlides[safeIndex].text;
            titleEl.style.opacity = '1';
            textEl.style.opacity = '1';
        }, 200);

        dotsContainer.innerHTML = getSlides().map((_, i) => `
            <button onclick="window.setSlide(${i})" 
                class="transition-all duration-300 rounded-full ${
                i === index ? 'w-8 h-1.5 bg-white' : 'w-2 h-1.5 bg-white/40 hover:bg-white/60'
            }"></button>
        `).join('');
    };

    updateSlide(currentSlideIndex);

    carouselInterval = setInterval(() => {
        currentSlideIndex = (currentSlideIndex + 1) % totalSlides;
        updateSlide(currentSlideIndex);
    }, 20000); 

    window.setSlide = (index) => {
        currentSlideIndex = index;
        clearInterval(carouselInterval);
        updateSlide(index);
        setTimeout(() => {
            if(carouselInterval) clearInterval(carouselInterval);
            carouselInterval = setInterval(() => {
                currentSlideIndex = (currentSlideIndex + 1) % totalSlides;
                updateSlide(currentSlideIndex);
            }, 20000);
        }, 20000);
    };
}

// ============================================
// RENDER FUNCTION 
// ============================================
function render() {
    if (!authContainer) return;

    const theme = brandingTheme || getCachedTheme() || {};
    const brandLogo = (theme.company_logo_url || '').trim() || DEFAULT_BRAND_LOGO;
    const wallpaper = (theme.auth_background_url || '').trim() || DEFAULT_AUTH_WALLPAPER;
    const overlayEnabled = typeof theme.auth_overlay_enabled === 'undefined'
        ? DEFAULT_AUTH_OVERLAY_ENABLED
        : theme.auth_overlay_enabled !== false;
    const overlayColor = normalizeHexColor(theme.auth_overlay_color, DEFAULT_AUTH_OVERLAY_COLOR);
    const shouldFlipWallpaper = Boolean(theme.auth_background_flip);
    const wallpaperScaleX = shouldFlipWallpaper ? '-1' : '1';
    const brandLogoAttr = escapeAttr(brandLogo);
    const wallpaperAttr = escapeAttr(wallpaper);
    const overlayColorAttr = escapeAttr(overlayColor);
    const companyName = escapeHtml(getActiveCompanyName());

    let mainHeading, subHeading, buttonText;
    
    switch(viewState) {
        case 'signup':
            mainHeading = 'Create Account';
            subHeading = 'Enter your details to get started';
            buttonText = 'Sign Up';
            break;
        case 'forgot':
            mainHeading = 'Forgot Password';
            subHeading = 'Enter your email to receive a reset link';
            buttonText = 'Send Reset Link';
            break;
        case 'login':
        default:
            mainHeading = 'Welcome Back!';
            subHeading = 'Sign in to your account';
            buttonText = 'Sign In';
            break;
    }

    const messageBanner = formMessage.text ? `
        <div class="p-3 rounded-lg mb-4 text-xs font-medium text-center border ${
            formMessage.type === 'success' 
            ? 'bg-green-500/20 text-green-100 border-green-500/30 lg:bg-green-50 lg:text-green-700 lg:border-green-200' 
            : 'bg-red-500/20 text-red-100 border-red-500/30 lg:bg-red-50 lg:text-red-700 lg:border-red-200'
        }">
            ${formMessage.text}
        </div>
    ` : '';

    const animationStyles = `
        <style>
            @keyframes kenBurns {
                0% { transform: scaleX(${wallpaperScaleX}) scale(1); }
                50% { transform: scaleX(${wallpaperScaleX}) scale(1.1); }
                100% { transform: scaleX(${wallpaperScaleX}) scale(1); }
            }
            .animate-ken-burns {
                animation: kenBurns 40s ease-in-out infinite alternate;
                will-change: transform;
            }
        </style>
    `;

    authContainer.innerHTML = `
    <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

        .auth-root * { box-sizing: border-box; }
        .auth-root {
            min-height: 100vh;
            display: flex;
            font-family: 'IBM Plex Sans', -apple-system, sans-serif;
            background: #FDF9F6;
        }

        /* ── Left panel — brand / wallpaper ───────────────────────── */
        .auth-left {
            display: none;
            position: relative;
            width: 52%;
            overflow: hidden;
            flex-shrink: 0;
        }
        @media(min-width:900px){ .auth-left { display: flex; flex-direction: column; } }

        .auth-left-bg {
            position: absolute; inset: 0;
            background-image: url('${wallpaperAttr}');
            background-size: cover; background-position: center;
            animation: kenBurns 40s ease-in-out infinite alternate;
            transform: scaleX(${wallpaperScaleX});
        }
        .auth-left-overlay {
            position: absolute; inset: 0;
            background: linear-gradient(160deg, rgba(15,23,42,0.72) 0%, rgba(231,118,46,0.35) 100%);
        }
        .auth-left-content {
            position: relative; z-index: 2;
            display: flex; flex-direction: column; justify-content: space-between;
            height: 100%; padding: 48px;
        }
        .auth-brand-logo {
            height: 44px; width: auto; object-fit: contain; object-position: left;
            filter: brightness(0) invert(1);
            opacity: 0.95;
        }
        .auth-carousel-body { max-width: 440px; }
        .auth-carousel-tag {
            display: inline-block;
            background: rgba(231,118,46,0.25);
            color: rgba(255,255,255,0.9);
            border: 1px solid rgba(231,118,46,0.4);
            font-size: 11px; font-weight: 700; letter-spacing: .1em;
            text-transform: uppercase;
            padding: 5px 14px; border-radius: 100px;
            margin-bottom: 20px;
        }
        #carousel-title {
            font-size: 36px; font-weight: 700;
            color: #fff; line-height: 1.2;
            margin: 0 0 16px; letter-spacing: -0.5px;
        }
        #carousel-text {
            font-size: 15px; font-weight: 400;
            color: rgba(255,255,255,0.75); line-height: 1.7;
            margin: 0 0 32px;
        }
        #carousel-dots { display: flex; gap: 6px; }
        .carousel-dot {
            width: 24px; height: 4px; border-radius: 2px;
            background: rgba(255,255,255,0.3);
            transition: all .3s ease; cursor: pointer;
        }
        .carousel-dot.active {
            background: var(--color-primary, #E7762E);
            width: 40px;
        }
        .auth-left-footer {
            font-size: 11px; color: rgba(255,255,255,0.4);
            font-weight: 500;
        }

        /* ── Right panel — form ───────────────────────────────────── */
        .auth-right {
            flex: 1;
            display: flex; align-items: center; justify-content: center;
            padding: 40px 24px;
            min-height: 100vh;
        }

        .auth-card {
            width: 100%; max-width: 420px;
        }

        /* Mobile logo */
        .auth-mobile-logo {
            display: flex; justify-content: center; margin-bottom: 32px;
        }
        .auth-mobile-logo img { height: 40px; width: auto; object-fit: contain; }
        @media(min-width:900px){ .auth-mobile-logo { display: none; } }

        /* Heading */
        .auth-heading { margin-bottom: 32px; }
        .auth-heading h2 {
            font-size: 28px; font-weight: 700;
            color: #0F172A; letter-spacing: -0.5px;
            margin: 0 0 6px;
        }
        .auth-heading p {
            font-size: 14px; color: #64748b; margin: 0; font-weight: 400;
        }

        /* Message banner */
        .auth-banner {
            padding: 12px 16px; border-radius: 12px;
            font-size: 13px; font-weight: 600;
            margin-bottom: 20px; display: flex; align-items: center; gap: 10px;
        }
        .auth-banner.error   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .auth-banner.success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

        /* Field */
        .auth-field { margin-bottom: 18px; }
        .auth-field label {
            display: block;
            font-size: 12px; font-weight: 700; letter-spacing: .06em;
            text-transform: uppercase; color: #475569;
            margin-bottom: 8px;
        }
        .auth-field input {
            width: 100%;
            padding: 13px 16px;
            border: 1.5px solid #e2e8f0;
            border-radius: 12px;
            font-size: 14px; font-weight: 400; color: #0F172A;
            background: #fff;
            outline: none;
            transition: border-color .2s, box-shadow .2s;
            font-family: 'IBM Plex Sans', sans-serif;
        }
        .auth-field input::placeholder { color: #94a3b8; }
        .auth-field input:focus {
            border-color: var(--color-primary, #E7762E);
            box-shadow: 0 0 0 3px rgba(231,118,46,0.12);
        }

        /* Forgot link */
        .auth-forgot {
            display: flex; justify-content: flex-end; margin-top: -10px; margin-bottom: 18px;
        }
        .auth-forgot button {
            background: none; border: none; padding: 0; cursor: pointer;
            font-size: 13px; font-weight: 600; color: var(--color-primary, #E7762E);
            font-family: inherit;
        }
        .auth-forgot button:hover { opacity: 0.75; }

        /* Submit */
        .auth-submit {
            width: 100%;
            padding: 14px;
            border: none; border-radius: 12px;
            font-size: 15px; font-weight: 700;
            color: #fff; cursor: pointer;
            background: linear-gradient(135deg, var(--color-primary, #E7762E) 0%, #f08840 100%);
            box-shadow: 0 4px 16px rgba(231,118,46,0.30), 0 1px 3px rgba(0,0,0,0.08);
            transition: transform .18s ease, box-shadow .18s ease;
            font-family: inherit;
            display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .auth-submit:hover {
            transform: translateY(-1px);
            box-shadow: 0 8px 24px rgba(231,118,46,0.40);
        }
        .auth-submit:active { transform: scale(0.98); }

        /* Divider */
        .auth-divider {
            display: flex; align-items: center; gap: 14px;
            margin: 24px 0;
        }
        .auth-divider span {
            font-size: 12px; color: #94a3b8; font-weight: 500; white-space: nowrap;
        }
        .auth-divider::before, .auth-divider::after {
            content: ''; flex: 1; height: 1px; background: #e2e8f0;
        }

        /* Footer switch */
        .auth-switch {
            text-align: center;
            font-size: 14px; color: #64748b;
        }
        .auth-switch button {
            background: none; border: none; padding: 0; cursor: pointer;
            font-size: 14px; font-weight: 700;
            color: var(--color-primary, #E7762E);
            font-family: inherit; margin-left: 4px;
        }
        .auth-switch button:hover { opacity: 0.75; }

        /* Legal */
        .auth-legal {
            margin-top: 32px; text-align: center;
            font-size: 11px; color: #94a3b8; line-height: 1.6;
        }

        @keyframes kenBurns {
            0%   { transform: scaleX(${wallpaperScaleX}) scale(1);   }
            50%  { transform: scaleX(${wallpaperScaleX}) scale(1.08); }
            100% { transform: scaleX(${wallpaperScaleX}) scale(1);   }
        }
    </style>

    <div class="auth-root">

        <!-- Left: Brand panel -->
        <div class="auth-left">
            <div class="auth-left-bg"></div>
            <div class="auth-left-overlay"></div>
            <div class="auth-left-content">
                <div>
                    <img src="${brandLogoAttr}" alt="${companyName}" class="auth-brand-logo">
                </div>
                <div class="auth-carousel-body">
                    <span class="auth-carousel-tag">Registered Credit Provider</span>
                    <h2 id="carousel-title"></h2>
                    <p id="carousel-text"></p>
                    <div id="carousel-dots"></div>
                </div>
                <div class="auth-left-footer">
                    NCR Registered · FSP 53423 · NCRCP13510
                </div>
            </div>
        </div>

        <!-- Right: Form panel -->
        <div class="auth-right">
            <div class="auth-card">

                <!-- Mobile logo -->
                <div class="auth-mobile-logo">
                    <img src="${brandLogoAttr}" alt="${companyName}">
                </div>

                <!-- Heading -->
                <div class="auth-heading">
                    <h2>${mainHeading}</h2>
                    <p>${subHeading}</p>
                </div>

                <!-- Message banner -->
                ${formMessage.text ? `
                <div class="auth-banner ${formMessage.type}">
                    <i class="fas fa-${formMessage.type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i>
                    ${formMessage.text}
                </div>` : ''}

                <!-- Form -->
                <form id="auth-form">
                    ${viewState === 'signup' ? `
                    <div class="auth-field">
                        <label for="full-name">Full Name</label>
                        <input id="full-name" name="fullName" type="text" required placeholder="John Smith">
                    </div>` : ''}

                    <div class="auth-field">
                        <label for="email-address">Email Address</label>
                        <input id="email-address" name="email" type="email" autocomplete="email" required placeholder="info@example.com">
                    </div>

                    ${viewState !== 'forgot' ? `
                    <div class="auth-field">
                        <label for="password">Password</label>
                        <input id="password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••">
                        ${viewState === 'signup' ? '<p style="font-size:12px;color:#94a3b8;margin-top:6px;">Minimum 6 characters.</p>' : ''}
                    </div>` : ''}

                    ${viewState === 'login' ? `
                    <div class="auth-forgot">
                        <button type="button" id="btn-to-forgot">Forgot Password?</button>
                    </div>` : ''}

                    <button type="submit" class="auth-submit">
                        <span id="auth-button-content">${buttonText}</span>
                    </button>
                </form>

                <div class="auth-divider"><span>or</span></div>

                <div class="auth-switch">${getFooterText()}</div>

                <div class="auth-legal">
                    ${companyName} is an authorised financial services<br>
                    provider (FSP 53423) · NCRCP13510<br>
                    © 2025 ${companyName}. All rights reserved.
                </div>

            </div>
        </div>
    </div>`;

    attachListeners();
    if(window.innerWidth >= 900) startCarousel();
}

function getFooterText() {
    const linkClasses = "font-bold text-blue-300 hover:text-white lg:text-blue-600 lg:hover:text-blue-500 ml-1";
    
    if (viewState === 'login') {
        return `Don't have an account? <button id="btn-to-signup" class="${linkClasses}">Register</button>`;
    } else if (viewState === 'signup') {
        return `Already have an account? <button id="btn-to-login" class="${linkClasses}">Login</button>`;
    } else {
        return `Remembered your password? <button id="btn-to-login" class="${linkClasses}">Login</button>`;
    }
}

// ============================================
// ATTACH LISTENERS 
// ============================================
function attachListeners() {
    const authForm = document.getElementById('auth-form');
    if (authForm) authForm.addEventListener('submit', handleAuth);

    const addClick = (id, newState) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => {
            viewState = newState;
            formMessage = { type: '', text: '' };
            render();
        });
    };

    addClick('btn-to-signup', 'signup');
    addClick('btn-to-login', 'login');
    addClick('btn-to-forgot', 'forgot');
}

// ============================================
// HANDLE AUTH 
// ============================================
async function handleAuth(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const buttonContent = document.getElementById('auth-button-content');
    const submitButton = e.target.querySelector('button[type="submit"]');
    
    submitButton.disabled = true;
    buttonContent.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2" style="color: var(--color-secondary, #000000);"></i> Processing...`;
    formMessage = { type: '', text: '' }; 

    try {
        if (viewState === 'login') {
            const password = e.target.password.value;
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) throw error;

            const isAllowed = await resolveAdminAccess(data?.session, 'base_admin');
            
            window.location.replace(isAllowed ? '/admin/dashboard' : '/user-portal/index.html');

        } else if (viewState === 'signup') {
            const password = e.target.password.value;
            const fullName = e.target.fullName.value;
            
            const { data, error } = await supabase.auth.signUp({ 
                email, 
                password,
                options: { data: { full_name: fullName } }
            });

            if (error) throw error;

            if (data.user) {
                supabase.from('profiles').insert({ 
                    id: data.user.id, 
                    full_name: fullName, 
                    email: data.user.email, 
                    role: 'borrower' 
                });

                viewState = 'login';
                formMessage = {
                    type: 'success',
                    text: 'Account created! Check your email to confirm. After confirming your email and logging in, you will be required to complete BOTH Financial Information and Declarations to unlock the user portal.'
                };
                render();
            }

        } else if (viewState === 'forgot') {
            const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + '/auth/update-password.html',
            });

            if (error) throw error;

            formMessage = { type: 'success', text: 'Password reset link sent to your email.' };
            viewState = 'login'; 
            render();
        }

    } catch (error) {
        formMessage = { type: 'error', text: error.message };
        render();
    }
}

// ============================================
// INITIALIZE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Global failsafe: if nothing renders within 10s, force the login form
    const failsafe = setTimeout(() => {
        const container = document.getElementById('auth-container');
        if (container && container.querySelector('.fa-spinner')) {
            console.warn('Failsafe triggered — forcing login form render');
            render();
        }
    }, 10000);

    checkSession().finally(() => clearTimeout(failsafe));
});