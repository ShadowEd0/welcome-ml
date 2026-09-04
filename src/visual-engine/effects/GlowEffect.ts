import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';

interface GlowHalo {
  x: number;
  y: number;
  radius: number;
  pulsePhase: number;
  pulseSpeed: number;
}

export class GlowEffect extends BaseEffect<GlowHalo> {
  constructor(id?: string) {
    super('glow', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.max(1, Math.floor(3 * context.qualityMultiplier));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: (this.viewport.width / (count + 1)) * (i + 1),
        y: this.viewport.height * 0.5,
        radius: Math.min(this.viewport.width, this.viewport.height) * 0.4,
        pulsePhase: i * (Math.PI / 2),
        pulseSpeed: 0.8,
      });
    }
  }

  public update(context: RenderContext): void {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].pulsePhase += context.deltaTime * this.particles[i].pulseSpeed;
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = (this.config.color as string) || '#FFD700';

    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const dynamicRadius = p.radius * (1 + 0.1 * Math.sin(p.pulsePhase));
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, dynamicRadius);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');

      ctx.globalAlpha = (0.15 + 0.05 * Math.sin(p.pulsePhase)) * ((this.config.opacity as number) ?? 1);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, dynamicRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}