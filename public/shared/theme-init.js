import { ensureThemeLoaded } from './theme-runtime.js';

const loadTheme = () => {
  try {
    return ensureThemeLoaded();
  } catch (error) {
    console.error('Theme init failed:', error);
    return Promise.resolve();
  }
};

loadTheme();
