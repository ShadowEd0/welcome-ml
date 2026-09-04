import { UniversePalette } from '../universes/types';
import { EffectConfig } from './types';

/** Transforme la palette « objet » d'un univers en tableau de couleurs exploitable. */
export function paletteFromUniverse(palette?: UniversePalette): string[] {
  if (!palette) return ['#FFFFFF'];
  const colors = [palette.primary, palette.secondary, palette.accent, ...(palette.backgroundGradient || [])]
    .filter((c): c is string => typeof c === 'string' && c.length > 0);
  const unique = Array.from(new Set(colors));
  return unique.length > 0 ? unique : ['#FFFFFF'];
}

/**
 * Chaîne de priorité : couleur(s) explicitement déclarée(s) sur l'effet dans le JSON,
 * sinon la palette entière de l'univers, sinon blanc. Corrige le bug §B3 : on ne
 * garde plus color[0] mais tout le tableau, laissé aux fonctions de sélection ci-dessous.
 */
export function resolveEffectPalette(config: Pick<EffectConfig, 'color' | 'palette'>): string[] {
  if (Array.isArray(config.color) && config.color.length > 0) return config.color;
  if (typeof config.color === 'string' && config.color) return [config.color];
  if (config.palette && config.palette.length > 0) return config.palette;
  return ['#FFFFFF'];
}

export function getPaletteColor(palette: string[], index: number): string {
  if (palette.length === 0) return '#FFFFFF';
  return palette[((index % palette.length) + palette.length) % palette.length];
}

export function getRandomPaletteColor(palette: string[]): string {
  return palette.length ? palette[Math.floor(Math.random() * palette.length)] : '#FFFFFF';
}

/** Favorise primary/secondary sans jamais exclure totalement l'accent — évite un rendu criard. */
export function getWeightedPaletteColor(palette: string[]): string {
  if (palette.length <= 1) return palette[0] || '#FFFFFF';
  const weights = palette.map((_, i) => Math.max(1, palette.length - i));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < palette.length; i++) {
    if (roll < weights[i]) return palette[i];
    roll -= weights[i];
  }
  return palette[0];
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  if (m.length !== 3 && m.length !== 6) return null;
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Utilisée pour les pulsations de couleur (cœur qui se forme, aurores...). */
export function interpolatePaletteColor(a: string, b: string, t: number): string {
  const rgbA = hexToRgb(a), rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return t < 0.5 ? a : b;
  const r = Math.round(rgbA.r + (rgbB.r - rgbA.r) * t);
  const g = Math.round(rgbA.g + (rgbB.g - rgbA.g) * t);
  const bch = Math.round(rgbA.b + (rgbB.b - rgbA.b) * t);
  return `rgb(${r}, ${g}, ${bch})`;
}

export function getGlowColor(palette?: UniversePalette): string {
  return palette?.glowColor || '#FFFFFF';
}