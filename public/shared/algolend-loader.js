// Zwane brand spiral loader — vanilla JS (this codebase has no React/shadcn stack).
// Usage:
//   import { mountAlgolendLoader } from '/shared/algolend-loader.js';
//   const loader = mountAlgolendLoader(document.body, { label: 'Loading...' });
//   loader.hide();   // fade out
//   loader.remove(); // remove from DOM

const LOADER_MARKUP = `
  <div class="algolend-loader">
    <svg class="gegga">
      <defs>
        <filter id="zwane-gegga">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -10" result="inreGegga" />
          <feComposite in="SourceGraphic" in2="inreGegga" operator="atop" />
        </filter>
      </defs>
    </svg>
    <svg class="snurra" width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="zwane-linjargradient">
          <stop class="stopp1" offset="0" />
          <stop class="stopp2" offset="1" />
        </linearGradient>
        <linearGradient y2="160" x2="160" y1="40" x1="40" gradientUnits="userSpaceOnUse" id="zwane-gradient" xlink:href="#zwane-linjargradient" />
      </defs>
      <path class="halvan" d="m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64" />
      <circle class="strecken" cx="100" cy="100" r="64" />
    </svg>
    <svg class="skugga" width="200" height="200" viewBox="0 0 200 200">
      <path class="halvan" d="m 164,100 c 0,-35.346224 -28.65378,-64 -64,-64 -35.346224,0 -64,28.653776 -64,64 0,35.34622 28.653776,64 64,64 35.34622,0 64,-26.21502 64,-64 0,-37.784981 -26.92058,-64 -64,-64 -37.079421,0 -65.267479,26.922736 -64,64 1.267479,37.07726 26.703171,65.05317 64,64 37.29683,-1.05317 64,-64 64,-64" />
      <circle class="strecken" cx="100" cy="100" r="64" />
    </svg>
  </div>
`;

export function mountAlgolendLoader(container = document.body, { label = '' } = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'algolend-loader-overlay';
    overlay.innerHTML = LOADER_MARKUP + (label ? `<div class="algolend-loader-label">${label}</div>` : '');

    // Wrap loader + label in a column so the label sits under the spinner.
    if (label) {
        const col = document.createElement('div');
        col.style.display = 'flex';
        col.style.flexDirection = 'column';
        col.style.alignItems = 'center';
        while (overlay.firstChild) col.appendChild(overlay.firstChild);
        overlay.appendChild(col);
    }

    container.appendChild(overlay);

    return {
        el: overlay,
        hide() { overlay.classList.add('hidden'); },
        show() { overlay.classList.remove('hidden'); },
        remove() { overlay.remove(); }
    };
}
