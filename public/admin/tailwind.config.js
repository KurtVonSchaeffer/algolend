export default {
  content: [
    "./*.html",
    "./src/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-accent':               '#E7762E',
        'brand-accent-hover':         '#F97316',
        'surface':                    '#f7f9fb',
        'surface-container-lowest':   '#ffffff',
        'surface-container-low':      '#f2f4f6',
        'surface-container':          '#eceef0',
        'surface-container-high':     '#e6e8ea',
        'surface-container-highest':  '#e0e3e5',
        'surface-variant':            '#e0e3e5',
        'on-surface':                 '#191c1e',
        'on-surface-variant':         '#564336',
        'outline-variant':            '#ddc1b0',
        'outline':                    '#8a7264',
        'error-container':            '#ffdad6',
        'error':                      '#ba1a1a',
      },
      fontFamily: {
        sans:     ['Inter', 'ui-sans-serif', 'system-ui'],
        headline: ['Montserrat', 'ui-sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
