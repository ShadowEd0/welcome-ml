import { IEffect, EffectConfig, RenderContext, ViewportSize } from './types';

export abstract class BaseEffect<TParticle> implements IEffect {
  public readonly id: string;
  public readonly type: string;
  protected particles: TParticle[] = [];
  protected config: EffectConfig = { type: 'base' };
  protected viewport: ViewportSize = { width: 0, height: 0, dpr: 1 };

  constructor(type: string, id?: string) {
    this.type = type;
    this.id = id || `${type}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public initialize(context: RenderContext, config: EffectConfig): void {
    this.config = config;
    this.viewport = context.viewport;
    this.initPool(context);
  }

  public updateConfig(config: EffectConfig): void {
    this.config = { ...this.config, ...config };
  }

  public resize(viewport: ViewportSize): void {
    this.viewport = viewport;
  }

  public destroy(): void {
    this.particles = [];
  }

  protected abstract initPool(context: RenderContext): void;
  public abstract update(context: RenderContext): void;
  public abstract render(context: RenderContext): void;

  protected get TargetParticleCount(): number {
    const baseCount = (this.config.count as number) || 50;
    return Math.floor(baseCount);
  }
}