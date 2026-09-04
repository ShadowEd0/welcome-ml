import { IEffect, EffectConfig, QualityLevel, RenderContext, ViewportSize, PointerState } from './types';
import { EffectFactory } from './EffectFactory';

export class VisualEngine {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private effects: IEffect[] = [];
  private animationFrameId: number | null = null;

  private quality: QualityLevel = 'AUTO';
  private qualityMultiplier = 1.0;
  private lastTime = 0;
  private elapsedTime = 0;
  private isPaused = false;

  private viewport: ViewportSize = { width: 0, height: 0, dpr: 1 };
  private pointer: PointerState = { x: 0, y: 0, isHovered: false };

  public initialize(canvas: HTMLCanvasElement, quality: QualityLevel = 'AUTO'): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.quality = quality;
    this.updateQualityMultiplier();

    this.handleResize();
    this.setupEventListeners();
    this.startLoop();
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;
    this.updateQualityMultiplier();
    this.reinitializeEffects();
  }

  private updateQualityMultiplier(): void {
    switch (this.quality) {
      case 'LOW':
        this.qualityMultiplier = 0.4;
        break;
      case 'MEDIUM':
        this.qualityMultiplier = 0.7;
        break;
      case 'HIGH':
        this.qualityMultiplier = 1.0;
        break;
      case 'ULTRA':
        this.qualityMultiplier = 1.4;
        break;
      case 'AUTO':
      default:
        this.qualityMultiplier = window.innerWidth < 768 ? 0.6 : 1.0;
        break;
    }
  }

  public loadUniverseConfig(effectConfigs: EffectConfig[]): void {
    this.clearEffects();

    const renderCtx = this.getRenderContext(0);
    for (const config of effectConfigs) {
      if (config.enabled === false) continue;
      const effect = EffectFactory.createEffect(config);
      if (effect) {
        effect.initialize(renderCtx, config);
        this.effects.push(effect);
      }
    }
  }

  private reinitializeEffects(): void {
    const renderCtx = this.getRenderContext(0);
    for (const effect of this.effects) {
      effect.initialize(renderCtx, (effect as unknown as { config: EffectConfig }).config || { type: effect.type });
    }
  }

  private startLoop(): void {
    this.lastTime = performance.now();
    const step = (now: number) => {
      if (!this.isPaused) {
        const deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        this.elapsedTime += deltaTime;

        this.update(deltaTime);
        this.render();
      }
      this.animationFrameId = requestAnimationFrame(step);
    };
    this.animationFrameId = requestAnimationFrame(step);
  }

  private update(deltaTime: number): void {
    const renderCtx = this.getRenderContext(deltaTime);
    for (let i = 0; i < this.effects.length; i++) {
      this.effects[i].update(renderCtx);
    }
  }

  private render(): void {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
    const renderCtx = this.getRenderContext(0);

    for (let i = 0; i < this.effects.length; i++) {
      this.effects[i].render(renderCtx);
    }
  }

  private getRenderContext(deltaTime: number): RenderContext {
    return {
      ctx: this.ctx!,
      viewport: this.viewport,
      pointer: this.pointer,
      deltaTime,
      elapsedTime: this.elapsedTime,
      qualityMultiplier: this.qualityMultiplier,
    };
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    if (this.canvas) {
      this.canvas.addEventListener('mousemove', this.handlePointerMove);
      this.canvas.addEventListener('mouseleave', this.handlePointerLeave);
      this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    }
  }

  private handleResize = (): void => {
    if (!this.canvas) return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.viewport = { width, height, dpr };

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }

    for (let i = 0; i < this.effects.length; i++) {
      this.effects[i].resize(this.viewport);
    }
  };

  private handleVisibilityChange = (): void => {
    this.isPaused = document.hidden;
  };

  private handlePointerMove = (e: MouseEvent): void => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    this.pointer.isHovered = true;
  };

  private handlePointerLeave = (): void => {
    this.pointer.isHovered = false;
  };

  private handleTouchMove = (e: TouchEvent): void => {
    if (e.touches.length > 0) {
      this.pointer.x = e.touches[0].clientX;
      this.pointer.y = e.touches[0].clientY;
      this.pointer.isHovered = true;
    }
  };

  public clearEffects(): void {
    for (let i = 0; i < this.effects.length; i++) {
      this.effects[i].destroy();
    }
    this.effects = [];
  }

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.clearEffects();
    this.canvas = null;
    this.ctx = null;
  }
}