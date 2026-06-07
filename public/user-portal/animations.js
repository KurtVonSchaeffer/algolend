/**
 * ZwanePortal — Animation Engine
 * Scroll reveals · Ripples · Tilt · Magnetic · Counter · Bottom nav bounce
 */

(function () {
  'use strict';

  /* ── 1. SCROLL-TRIGGERED REVEALS ─────────────────────────────── */
  function initReveal() {
    // Mark elements to reveal: cards, list items, stat values, section headers
    const SELECTORS = [
      '.card', '.metric-card', '.loan-card', '.action-card',
      '.modern-list-item', '.notif-item',
      '.section-card', '.payments-grid > *',
      '.metric-value', '.card-value',
      '.minimal-header', '.notifications-header',
      '.notif-filter-row', '.quick-actions-bar',
    ].join(',');

    const candidates = document.querySelectorAll(SELECTORS);
    candidates.forEach((el, i) => {
      if (!el.classList.contains('reveal')) {
        el.classList.add('reveal');
        el.style.setProperty('--reveal-delay', `${Math.min(i * 0.055, 0.45)}s`);
      }
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  /* ── 2. RIPPLE ON CLICK ──────────────────────────────────────── */
  function addRipple(e) {
    const el = e.currentTarget;
    if (!el.classList.contains('ripple-host')) return;

    const rect  = el.getBoundingClientRect();
    const size  = Math.max(rect.width, rect.height) * 1.4;
    const x     = e.clientX - rect.left - size / 2;
    const y     = e.clientY - rect.top  - size / 2;

    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;`;
    el.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove());
  }

  function initRipples() {
    const RIPPLE_SELECTORS = [
      'button', '.btn', '.action-card', '.modern-list-item',
      '.notif-item', '.notif-filter-btn', '.metric-card',
      '.loan-card', '.filter-btn', '.tab-btn',
    ].join(',');

    function attachRipple(el) {
      if (el._rippleAttached) return;
      el._rippleAttached = true;

      const isLight = window.getComputedStyle(el).backgroundColor
        .replace(/\s/g, '').match(/rgba?\((\d+),(\d+),(\d+)/);
      const brightness = isLight
        ? (parseInt(isLight[1]) * 299 + parseInt(isLight[2]) * 587 + parseInt(isLight[3]) * 114) / 1000
        : 200;

      el.classList.add('ripple-host');
      if (brightness > 160) el.classList.add('ripple-dark');
      el.addEventListener('pointerdown', addRipple);
    }

    document.querySelectorAll(RIPPLE_SELECTORS).forEach(attachRipple);

    // Re-run when new content loads (SPA page changes)
    new MutationObserver(() => {
      document.querySelectorAll(RIPPLE_SELECTORS).forEach(attachRipple);
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ── 3. 3-D CARD TILT ────────────────────────────────────────── */
  function initTilt() {
    const TILT_SELECTORS = '.metric-card, .card, .loan-card';
    const MAX_TILT = 6; // degrees

    function attachTilt(el) {
      if (el._tiltAttached) return;
      el._tiltAttached = true;
      el.classList.add('tilt-card');

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  + rect.height / 2;
        const dx   = (e.clientX - cx) / (rect.width  / 2);
        const dy   = (e.clientY - cy) / (rect.height / 2);
        el.style.setProperty('--tilt-x', `${(-dy * MAX_TILT).toFixed(2)}deg`);
        el.style.setProperty('--tilt-y', `${ (dx * MAX_TILT).toFixed(2)}deg`);
      });

      el.addEventListener('mouseleave', () => {
        el.style.setProperty('--tilt-x', '0deg');
        el.style.setProperty('--tilt-y', '0deg');
      });
    }

    document.querySelectorAll(TILT_SELECTORS).forEach(attachTilt);
    new MutationObserver(() => {
      document.querySelectorAll(TILT_SELECTORS).forEach(attachTilt);
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ── 4. MAGNETIC HOVER ───────────────────────────────────────── */
  function initMagnetic() {
    const MAGNETIC_SELECTORS = '.action-btn.primary, .btn-primary, .quote-btn';
    const STRENGTH = 0.35;

    function attachMagnetic(el) {
      if (el._magneticAttached) return;
      el._magneticAttached = true;
      el.classList.add('magnetic');

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const dx   = (e.clientX - (rect.left + rect.width  / 2)) * STRENGTH;
        const dy   = (e.clientY - (rect.top  + rect.height / 2)) * STRENGTH;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    }

    document.querySelectorAll(MAGNETIC_SELECTORS).forEach(attachMagnetic);
    new MutationObserver(() => {
      document.querySelectorAll(MAGNETIC_SELECTORS).forEach(attachMagnetic);
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ── 5. COUNTER ANIMATION ────────────────────────────────────── */
  function animateCounter(el) {
    const raw = el.textContent.trim();
    // Match patterns like R 12,500.00 | 750 | R12,500 | 94%
    const numMatch = raw.match(/[\d,]+(\.\d+)?/);
    if (!numMatch) return;

    const numStr  = numMatch[0].replace(/,/g, '');
    const target  = parseFloat(numStr);
    if (isNaN(target) || target === 0) return;

    const prefix  = raw.substring(0, raw.indexOf(numMatch[0]));
    const suffix  = raw.substring(raw.indexOf(numMatch[0]) + numMatch[0].length);
    const decimals = (numMatch[1] || '').length - 1; // -1 for the dot
    const duration = Math.min(1200, Math.max(600, target / 4));
    const start    = performance.now();

    el.classList.add('counting');

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const ease     = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      const current  = ease * target;

      const formatted = decimals > 0
        ? current.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        : Math.round(current).toLocaleString('en-ZA');

      el.textContent = prefix + formatted + suffix;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = raw; // restore exact original
        el.classList.remove('counting');
      }
    }
    requestAnimationFrame(tick);
  }

  function initCounters() {
    const COUNTER_SELECTORS = '.card-value, .metric-value, .loan-amount';

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target._counted) {
          entry.target._counted = true;
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    function attachCounters() {
      document.querySelectorAll(COUNTER_SELECTORS).forEach(el => {
        if (!el._counted) observer.observe(el);
      });
    }

    attachCounters();
    new MutationObserver(attachCounters)
      .observe(document.body, { childList: true, subtree: true });
  }

  /* ── 6. BOTTOM NAV ACTIVE BOUNCE ─────────────────────────────── */
  function initBottomNavBounce() {
    function triggerBounce(icon) {
      if (!icon) return;
      icon.style.animation = 'none';
      // Force reflow
      void icon.offsetWidth;
      icon.style.animation = 'navBounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both';
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-page], .nav-tab, .bottom-nav-item');
      if (!btn) return;
      const icon = btn.querySelector('i, svg, .nav-icon, .bottom-nav-icon');
      if (icon) triggerBounce(icon);
    });
  }

  /* ── 7. RE-INIT ON SPA PAGE CHANGE ───────────────────────────── */
  // The portal's script.js replaces #main-content innerHTML on navigation.
  // Watch for that and re-run all inits.
  function watchPageChanges() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    new MutationObserver(() => {
      // Small delay to let the new page's own JS run first
      setTimeout(() => {
        initReveal();
        initTilt();
        initCounters();
      }, 80);
    }).observe(mainContent, { childList: true });
  }

  /* ── 8. STAGGER EXISTING NOTIF ITEMS / LIST ROWS ─────────────── */
  function staggerExistingLists() {
    const lists = document.querySelectorAll(
      '.notif-container, .modern-list, .loans-grid, .payments-table tbody'
    );
    lists.forEach(list => {
      Array.from(list.children).forEach((child, i) => {
        if (!child.style.animationDelay) {
          child.style.animationDelay = `${i * 0.06}s`;
        }
      });
    });
  }

  /* ── BOOT ─────────────────────────────────────────────────────── */
  function boot() {
    initRipples();
    initReveal();
    initTilt();
    initMagnetic();
    initCounters();
    initBottomNavBounce();
    watchPageChanges();
    staggerExistingLists();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
