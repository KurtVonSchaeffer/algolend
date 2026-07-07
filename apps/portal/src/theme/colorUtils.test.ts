import { describe, it, expect } from 'vitest';
import {
  hexToRgb,
  rgbToHex,
  adjustColor,
  getContrastColor,
  normalizeHexColor,
  normalizeTheme
} from './colorUtils';
import { DEFAULT_SYSTEM_SETTINGS } from './constants';

describe('hexToRgb', () => {
  it('parses a 6-digit hex color', () => {
    expect(hexToRgb('#7C3AED')).toEqual({ r: 124, g: 58, b: 237 });
  });

  it('parses a 3-digit hex color by doubling each digit', () => {
    expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns black for an invalid or empty value', () => {
    expect(hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb('#zzzzzz')).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('rgbToHex', () => {
  it('formats and uppercases the hex string', () => {
    expect(rgbToHex(124, 58, 237)).toBe('#7C3AED');
  });

  it('clamps out-of-range channel values', () => {
    expect(rgbToHex(300, -10, 128)).toBe('#FF0080');
  });
});

describe('adjustColor', () => {
  it('lightens toward white with a positive amount', () => {
    expect(adjustColor('#000000', 0.5)).toBe('#808080');
  });

  it('darkens toward black with a negative amount', () => {
    expect(adjustColor('#7C3AED', -1)).toBe('#000000');
  });

  it('returns the same color when amount is 0', () => {
    expect(adjustColor('#7C3AED', 0)).toBe('#7C3AED');
  });
});

describe('getContrastColor', () => {
  it('returns dark text for a light background', () => {
    expect(getContrastColor('#FFFFFF')).toBe('#0F172A');
  });

  it('returns light text for a dark background', () => {
    expect(getContrastColor('#000000')).toBe('#FFFFFF');
  });
});

describe('normalizeHexColor', () => {
  it('accepts a valid 6-digit hex and uppercases it', () => {
    expect(normalizeHexColor('#7c3aed', '#000000')).toBe('#7C3AED');
  });

  it('falls back for garbage input', () => {
    expect(normalizeHexColor('not-a-color', '#123456')).toBe('#123456');
  });

  it('falls back for empty input', () => {
    expect(normalizeHexColor('', '#123456')).toBe('#123456');
  });
});

describe('normalizeTheme', () => {
  it('fills in defaults for missing fields', () => {
    const result = normalizeTheme({});
    expect(result.primary_color).toBe(DEFAULT_SYSTEM_SETTINGS.primary_color);
    expect(result.carousel_slides).toHaveLength(3);
  });

  it('keeps valid overrides from the server payload', () => {
    const result = normalizeTheme({ primary_color: '#123456', theme_mode: 'light' });
    expect(result.primary_color).toBe('#123456');
    expect(result.theme_mode).toBe('light');
  });

  it('rejects an invalid overlay color and falls back to the default', () => {
    const result = normalizeTheme({ auth_overlay_color: 'nope' });
    expect(result.auth_overlay_color).toBe(DEFAULT_SYSTEM_SETTINGS.auth_overlay_color);
  });

  it('trims and defaults an empty company name', () => {
    const result = normalizeTheme({ company_name: '   ' });
    expect(result.company_name).toBe(DEFAULT_SYSTEM_SETTINGS.company_name);
  });
});
