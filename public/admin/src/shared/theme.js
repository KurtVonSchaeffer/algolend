import {
  ensureThemeLoaded as sharedEnsureThemeLoaded,
  previewTheme as sharedPreviewTheme,
  persistTheme as sharedPersistTheme,
  resetThemePreview as sharedResetThemePreview,
  getCachedTheme as sharedGetCachedTheme,
  getCompanyName as sharedGetCompanyName,
  DEFAULT_SYSTEM_SETTINGS
} from '../../../shared/theme-runtime.js';

export const ensureThemeLoaded = (options = {}) => sharedEnsureThemeLoaded(options);
export const previewTheme = (partialTheme = {}) => sharedPreviewTheme(partialTheme);
export const persistTheme = (theme) => sharedPersistTheme(theme);
export const resetThemePreview = () => sharedResetThemePreview();
export const getCachedTheme = () => sharedGetCachedTheme();
export const getCompanyName = (theme) => sharedGetCompanyName(theme);
export { DEFAULT_SYSTEM_SETTINGS };
