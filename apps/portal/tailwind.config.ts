import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
          strong: 'var(--color-primary-strong)',
          contrast: 'var(--color-primary-contrast)'
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          soft: 'var(--color-secondary-soft)'
        },
        tertiary: 'var(--color-tertiary)'
      },
      backgroundImage: {
        'gradient-brand': 'var(--gradient-brand)'
      }
    }
  },
  plugins: []
} satisfies Config;
