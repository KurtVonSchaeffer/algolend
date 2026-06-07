import { supabase } from '../Services/supabaseClient.js';
import { ensureThemeLoaded, getCachedTheme, DEFAULT_SYSTEM_SETTINGS, getCompanyName } from '../shared/theme-runtime.js';

const authContainer = document.getElementById('auth-container');

// State Management
let viewState = 'login'; // Options: 'login', 'signup', 'forgot'
let formMessage = { type: '', text: '' }; 
let brandingTheme = null;

const DEFAULT_BRAND_LOGO = 'https://placehold.co/240x80?text=Your+Logo';
const DEFAULT_AUTH_WALLPAPER = 'https://static.wixstatic.com/media/f82622_a05fcfc8600d48818feb2feeef4796fa~mv2.png';
const DEFAULT_AUTH_OVERLAY_COLOR = DEFAULT_SYSTEM_SETTINGS.auth_overlay_color || '#EA580C';
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

async function ensureBrandingTheme(force = false) {
    try {
        const theme = await ensureThemeLoaded({ force });
        brandingTheme = theme || {};
        carouselSlides = sanitizeCarouselSlides(theme?.carousel_slides);
        currentSlideIndex = 0;
        return brandingTheme;
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
    const { data: { session } } = await supabase.auth.getSession();
    await ensureBrandingTheme();
    if (session) {
        const { data: isAllowed, error } = await supabase.rpc('is_role_or_higher', { 
            p_min_role: 'base_admin' 
        });

        if (error) {
            console.error('Error checking role:', error.message);
            await supabase.auth.signOut();
            render();
            return;
        }
        
        if (isAllowed) {
            window.location.replace('/admin/dashboard');
        } else {
            window.location.replace('/user-portal/index.html');
        }
    } else {
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
    ${animationStyles}
    
    <div class="relative min-h-screen w-full lg:fixed lg:inset-0 lg:h-screen lg:overflow-hidden font-sans bg-black">
        
        <div class="fixed inset-0 w-full h-full z-0 pointer-events-none overflow-hidden">
            <div class="animate-ken-burns absolute inset-0 w-full h-full" 
                 style="background-image: url('${wallpaperAttr}'); 
                        background-size: cover; 
                        background-position: center;
                        transform: scaleX(${wallpaperScaleX});">
            </div>
            ${overlayEnabled ? `
            <div class="absolute inset-0 mix-blend-multiply" style="background-color:${overlayColorAttr}; opacity:0.35;"></div>` : ''}
            <div class="absolute inset-0 bg-black/40"></div>
        </div>

        <div class="hidden lg:flex absolute inset-y-0 left-0 z-10 p-12 flex-col justify-between pointer-events-none w-2/3">
            <div class="pointer-events-auto">
                <img src="${brandLogoAttr}" alt="Company logo" class="h-16 w-auto object-contain">
            </div>
            <div class="mb-12 max-w-lg pointer-events-auto">
                <h1 id="carousel-title" class="text-white text-5xl font-bold mb-6 leading-tight transition-opacity duration-300 whitespace-pre-line"></h1>
                <p id="carousel-text" class="text-white text-lg font-light leading-relaxed mb-8 transition-opacity duration-300"></p>
                <div id="carousel-dots" class="flex gap-2"></div>
            </div>
        </div>

        <div class="relative z-20 min-h-screen flex flex-col items-center justify-center py-12 
                    lg:absolute lg:right-0 lg:top-0 lg:h-full lg:w-1/3 lg:bg-white lg:shadow-2xl lg:py-0 lg:block">
            
            <div class="w-[90%] max-w-md p-6 rounded-2xl shadow-2xl bg-white/10 backdrop-blur-xl border border-white/20 
                        lg:w-full lg:max-w-md lg:h-full lg:mx-auto lg:bg-transparent lg:border-0 lg:shadow-none lg:p-12 
                        flex flex-col justify-center transition-all duration-300">
                
                <div class="w-full">
                    
                    <div class="lg:hidden mb-6 flex justify-center">
                        <img src="${brandLogoAttr}" alt="Company logo" class="h-10 w-auto opacity-90 object-contain">
                    </div>

                    <div class="mb-6 text-center">
                        <h2 class="text-3xl font-bold text-white lg:text-gray-900 mb-2">${mainHeading}</h2>
                        <p class="text-gray-200 lg:text-gray-500 text-sm">${subHeading}</p>
                    </div>
                    
                                        <form id="auth-form" class="space-y-4">
                                                ${messageBanner}

                                                ${viewState === 'signup' ? `
                                                <div>
                                                    <label for="full-name" class="block text-xs font-bold text-gray-200 lg:text-gray-700 uppercase mb-1">Full Name</label>
                                                    <input id="full-name" name="fullName" type="text" required 
                                                        class="w-full px-4 py-3 rounded border border-white/30 bg-white/10 text-white placeholder-gray-300 focus:bg-white/20 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition-all
                                                                     lg:border-gray-300 lg:bg-white lg:text-gray-900 lg:placeholder-gray-400" 
                                                        placeholder="eg. John Francisco">
                                                </div>
                                                ` : ''}

                                                <div>
                                                    <label for="email-address" class="block text-xs font-bold text-gray-200 lg:text-gray-700 uppercase mb-1">Email Address</label>
                                                    <input id="email-address" name="email" type="email" autocomplete="email" required 
                                                        class="w-full px-4 py-3 rounded border border-white/30 bg-white/10 text-white placeholder-gray-300 focus:bg-white/20 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition-all
                                                                     lg:border-gray-300 lg:bg-white lg:text-gray-900 lg:placeholder-gray-400" 
                                                        placeholder="info@example.com">
                                                </div>

                                                ${viewState !== 'forgot' ? `
                                                <div>
                                                    <label for="password" class="block text-xs font-bold text-gray-200 lg:text-gray-700 uppercase mb-1">Password</label>
                                                    <div class="relative">
                                                        <input id="password" name="password" type="password" autocomplete="current-password" required 
                                                            class="w-full px-4 py-3 rounded border border-white/30 bg-white/10 text-white placeholder-gray-300 focus:bg-white/20 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 focus:outline-none transition-all
                                                                         lg:border-gray-300 lg:bg-white lg:text-gray-900 lg:placeholder-gray-400" 
                                                            placeholder="********">
                                                    </div>
                                                    ${viewState === 'signup' ? `<p class="mt-1 text-xs text-gray-300 lg:text-gray-500">Must be at least 6 characters.</p>` : ''}
                                                </div>
                                                ` : ''}

                                                ${viewState === 'login' ? `
                                                <div class="flex justify-end text-sm">
                                                    <button type="button" id="btn-to-forgot" class="text-gray-200 hover:text-white lg:text-gray-500 lg:hover:text-orange-600 transition-colors font-medium">Forgot Password?</button>
                                                </div>
                                                ` : ''}

                                                <button type="submit" 
                                                    class="w-full flex justify-center py-3 px-4 border border-transparent rounded shadow-sm text-sm font-bold text-white 
                                                                 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2"
                                                    style="background-color: var(--color-primary, #E7762E);"
                                                    onmouseenter="this.style.backgroundColor = 'var(--color-primary-hover, #cf5f20)'"
                                                    onmouseleave="this.style.backgroundColor = 'var(--color-primary, #E7762E)'">
                                                    <span id="auth-button-content">${buttonText}</span>
                                                </button>
                                        </form>

                    <div class="relative my-6">
                        <div class="absolute inset-0 flex items-center">
                            <div class="w-full border-t border-white/20 lg:border-gray-200"></div>
                        </div>
                        <div class="relative flex justify-center text-sm">
                            <span class="px-2 bg-transparent text-gray-300 lg:bg-white lg:text-gray-500">or</span>
                        </div>
                    </div>

                    <div class="text-center">
                        <p class="text-sm text-gray-200 lg:text-gray-600">
                            ${getFooterText()}
                        </p>
                    </div>
                </div>

                <div class="mt-8 pt-4 text-center border-t border-white/10 lg:border-gray-100 lg:mt-auto">
                    <p class="text-[10px] text-gray-300 lg:text-sm lg:text-gray-500 leading-tight opacity-70 hover:opacity-100 transition-opacity">
                        ${companyName} is an authorised financial services provider (FSP 53423) and registered credit provider (NCRCP13510).
                        <br class="mb-1">
                        Copyright © 2025 by ${companyName}. All Right Reserved.
                    </p>
                </div>

            </div>
        </div>
    </div>`;

    attachListeners();
    if(window.innerWidth >= 1024) startCarousel(); 
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

            let isAllowed = false;
            const { data: rpcAllowed, error: rpcError } = await supabase.rpc('is_role_or_higher', { p_min_role: 'base_admin' });

            if (rpcError) {
                console.warn('is_role_or_higher RPC failed, falling back to JWT app_metadata role:', rpcError);
                const role = (data?.user?.app_metadata?.role || data?.user?.user_metadata?.role || '').toLowerCase();
                isAllowed = ['base_admin', 'admin', 'super_admin', 'owner'].includes(role);
            } else {
                isAllowed = !!rpcAllowed;
            }

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
// ===========================================
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});