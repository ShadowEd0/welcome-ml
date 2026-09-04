import { UniverseConfig } from './types';

export function validateUniverseConfig(data: unknown): { valid: boolean; config?: UniverseConfig; errors?: string[] } {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Universe configuration must be an object.'] };
  }

  const obj = data as Partial<UniverseConfig>;

  if (!obj.id || typeof obj.id !== 'string') errors.push('Missing or invalid "id" property.');
  if (!obj.name || typeof obj.name !== 'string') errors.push('Missing or invalid "name" property.');

  if (!obj.palette || typeof obj.palette !== 'object') {
    errors.push('Missing or invalid "palette" configuration.');
  } else {
    if (!obj.palette.primary) errors.push('Missing palette.primary.');
    if (!obj.palette.secondary) errors.push('Missing palette.secondary.');
    if (!obj.palette.accent) errors.push('Missing palette.accent.');
    if (!Array.isArray(obj.palette.backgroundGradient)) errors.push('palette.backgroundGradient must be an array.');
  }

  if (!obj.background || typeof obj.background !== 'object' || !Array.isArray(obj.background.colors)) {
    errors.push('Missing or invalid "background" configuration.');
  }

  if (!Array.isArray(obj.effects)) {
    errors.push('Property "effects" must be an array.');
  }

  if (!obj.atmosphere || typeof obj.atmosphere !== 'object') {
    errors.push('Missing or invalid "atmosphere" configuration.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Graceful defaults
  const validatedConfig: UniverseConfig = {
    id: obj.id!,
    name: obj.name!,
    palette: {
      primary: obj.palette?.primary || '#ffffff',
      secondary: obj.palette?.secondary || '#cccccc',
      accent: obj.palette?.accent || '#ff007f',
      backgroundGradient: obj.palette?.backgroundGradient || ['#0a0a1a', '#000000'],
      glowColor: obj.palette?.glowColor || '#ffffff',
      textColor: obj.palette?.textColor || '#ffffff',
      cardBorderColor: obj.palette?.cardBorderColor || 'rgba(255, 255, 255, 0.2)',
    },
    background: {
      type: obj.background?.type || 'gradient',
      colors: obj.background?.colors || ['#0a0a1a', '#000000'],
      angle: obj.background?.angle ?? 180,
    },
    effects: Array.isArray(obj.effects) ? obj.effects : [],
    atmosphere: {
      blurLevel: obj.atmosphere?.blurLevel ?? 0,
      opacity: obj.atmosphere?.opacity ?? 1.0,
      ambientLight: obj.atmosphere?.ambientLight || 'rgba(255, 255, 255, 0.05)',
    },
    intensity: obj.intensity ?? 1.0,
    speed: obj.speed ?? 1.0,
    density: obj.density ?? 1.0,
    compatibleWith: Array.isArray(obj.compatibleWith) ? obj.compatibleWith : [],
  };

  return { valid: true, config: validatedConfig };
}