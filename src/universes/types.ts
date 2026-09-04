import { EffectConfig } from '../visual-engine/types';

export interface UniversePalette {
  primary: string;
  secondary: string;
  accent: string;
  backgroundGradient: string[];
  glowColor: string;
  textColor: string;
  cardBorderColor: string;
}

export interface UniverseBackground {
  type: 'gradient' | 'radial' | 'mesh';
  colors: string[];
  angle?: number;
  glowPosition?: { x: number; y: number };
}

export interface UniverseAtmosphere {
  blurLevel: number; // in pixels
  opacity: number;  // 0.0 - 1.0
  ambientLight: string;
}

export interface UniverseConfig {
  id: string;
  name: string;
  palette: UniversePalette;
  background: UniverseBackground;
  effects: EffectConfig[];
  atmosphere: UniverseAtmosphere;
  intensity?: number; // 0.1 - 2.0 multiplier
  speed?: number;     // 0.1 - 2.0 multiplier
  density?: number;   // 0.1 - 2.0 multiplier
  compatibleWith?: string[]; // list of compatible universe IDs for smooth randomization
}

export interface TransitionState {
  isTransitioning: boolean;
  progress: number; // 0.0 to 1.0
  fromUniverse: UniverseConfig | null;
  toUniverse: UniverseConfig | null;
  currentEvolvedConfig: UniverseConfig | null;
}