import { DEFAULT_SYSTEM_SETTINGS, DEFAULT_CAROUSEL_SLIDES, type SystemSettings, type CarouselSlide } from './constants';

export const clamp = (value: number, min = 0, max = 255): number =>
  Math.max(min, Math.min(max, value));

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  if (!hex) return { r: 0, g: 0, b: 0 };
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized
      .split('')
      .map((char) => char + char)
      .join('');
  }
  const intVal = parseInt(normalized, 16);
  if (Number.isNaN(intVal) || normalized.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255
  };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (c: number) => clamp(Math.round(c)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

export const adjustColor = (hex: string, amount = 0): string => {
  const { r, g, b } = hexToRgb(hex);
  const delta = (channel: number) =>
    amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount);
  return rgbToHex(delta(r), delta(g), delta(b));
};

export const getContrastColor = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#0F172A' : '#FFFFFF';
};

export const normalizeBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
};

export const normalizeCompanyName = (value: unknown): string => {
  const name = typeof value === 'string' ? value.trim() : '';
  return name || DEFAULT_SYSTEM_SETTINGS.company_name;
};

export const normalizeHexColor = (value: unknown, fallback: string): string => {
  if (!value) return fallback;
  let hex = `${value}`.trim().replace('#', '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return fallback;
  }
  return `#${hex.toUpperCase()}`;
};

const sanitizeSlide = (slide: Partial<CarouselSlide> = {}, fallback: CarouselSlide): CarouselSlide => {
  const safeTitle = typeof slide.title === 'string' ? slide.title.trim() : '';
  const safeText = typeof slide.text === 'string' ? slide.text.trim() : '';
  return {
    title: safeTitle || fallback.title,
    text: safeText || fallback.text
  };
};

export const normalizeCarouselSlides = (slides: unknown): CarouselSlide[] => {
  const incoming = Array.isArray(slides) ? (slides as Partial<CarouselSlide>[]) : [];
  return DEFAULT_CAROUSEL_SLIDES.map((fallback, index) => sanitizeSlide(incoming[index] || {}, fallback));
};

export const normalizeTheme = (theme: Partial<SystemSettings> = {}): SystemSettings => ({
  ...DEFAULT_SYSTEM_SETTINGS,
  ...theme,
  company_name: normalizeCompanyName(theme?.company_name),
  auth_background_flip: normalizeBoolean(theme?.auth_background_flip, DEFAULT_SYSTEM_SETTINGS.auth_background_flip),
  auth_overlay_color: normalizeHexColor(theme?.auth_overlay_color, DEFAULT_SYSTEM_SETTINGS.auth_overlay_color),
  auth_overlay_enabled: normalizeBoolean(theme?.auth_overlay_enabled, DEFAULT_SYSTEM_SETTINGS.auth_overlay_enabled),
  carousel_slides: normalizeCarouselSlides(theme.carousel_slides)
});

export const computeCssVariables = (theme: SystemSettings): Record<string, string> => {
  const primaryRgb = hexToRgb(theme.primary_color);
  const secondaryRgb = hexToRgb(theme.secondary_color);
  const tertiaryRgb = hexToRgb(theme.tertiary_color);

  return {
    '--color-primary': theme.primary_color,
    '--color-primary-rgb': `${primaryRgb.r} ${primaryRgb.g} ${primaryRgb.b}`,
    '--color-primary-hover': adjustColor(theme.primary_color, -0.15),
    '--color-primary-soft': adjustColor(theme.primary_color, 0.2),
    '--color-primary-strong': adjustColor(theme.primary_color, -0.35),
    '--color-secondary': theme.secondary_color,
    '--color-secondary-rgb': `${secondaryRgb.r} ${secondaryRgb.g} ${secondaryRgb.b}`,
    '--color-secondary-soft': adjustColor(theme.secondary_color, 0.15),
    '--color-tertiary': theme.tertiary_color,
    '--color-tertiary-rgb': `${tertiaryRgb.r} ${tertiaryRgb.g} ${tertiaryRgb.b}`,
    '--gradient-brand': `linear-gradient(120deg, ${theme.primary_color}, ${theme.secondary_color}, ${theme.tertiary_color})`,
    '--color-primary-contrast': getContrastColor(theme.primary_color),
    '--auth-overlay-color': theme.auth_overlay_color,
    '--auth-overlay-enabled': theme.auth_overlay_enabled ? '1' : '0'
  };
};

export const applyCssVariables = (theme: SystemSettings): void => {
  const root = document.documentElement;
  const vars = computeCssVariables(theme);
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  // The user portal always renders light (matches legacy portal); the
  // legacy [data-theme='dark'] variables would otherwise darken inputs/cards.
  root.setAttribute('data-theme', 'light');
};
