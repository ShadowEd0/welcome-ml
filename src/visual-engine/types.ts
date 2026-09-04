export type QualityLevel = 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';

export interface ViewportSize {
  width: number;
  height: number;
  dpr: number;
}

export interface PointerState {
  x: number;
  y: number;
  isHovered: boolean;
}

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  viewport: ViewportSize;
  pointer: PointerState;
  deltaTime: number;
  elapsedTime: number;
  qualityMultiplier: number;
}

export interface EffectConfig {
  type: string;
  enabled?: boolean;
  color?: string | string[];
  palette?: string[];
  count?: number;
  speed?: number;
  size?: number;
  opacity?: number;
  interactive?: boolean;
  [key: string]: unknown;
}

export interface IEffect {
  readonly id: string;
  readonly type: string;
  initialize(context: RenderContext, config: EffectConfig): void;
  update(context: RenderContext): void;
  render(context: RenderContext): void;
  resize(viewport: ViewportSize): void;
  destroy(): void;
  updateConfig(config: EffectConfig): void;
}
