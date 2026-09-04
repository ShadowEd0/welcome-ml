import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';
import { resolveEffectPalette, getWeightedPaletteColor } from '../palette';

interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: string;
}

export class StarsEffect extends BaseEffect<Star> {
  constructor(id?: string) {
    super('stars', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.floor(this.TargetParticleCount * context.qualityMultiplier);
    this.particles = [];
    const colors = Array.isArray(this.config.color) ? this.config.color : ['#FFFFFF'];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.viewport.width,
        y: Math.random() * this.viewport.height,
        size: (Math.random() * 1.5 + 0.5) * ((this.config.size as number) || 1),
        baseAlpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 2 + 0.5,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  public update(context: RenderContext): void {
    const speed = (this.config.speed as number) || 1;
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].twinklePhase += context.deltaTime * this.particles[i].twinkleSpeed * speed;
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = Array.isArray(this.config.color) ? this.config.color[0] : (this.config.color as string) || '#FFFFFF';

    ctx.save();
    ctx.fillStyle = color;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const alpha = p.baseAlpha * (0.5 + 0.5 * Math.sin(p.twinklePhase)) * ((this.config.opacity as number) ?? 1);

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}