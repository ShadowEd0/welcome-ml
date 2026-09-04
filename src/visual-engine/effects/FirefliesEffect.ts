import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';

interface Firefly {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  pulsePhase: number;
  pulseSpeed: number;
  baseAlpha: number;
}

export class FirefliesEffect extends BaseEffect<Firefly> {
  constructor(id?: string) {
    super('fireflies', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.floor(this.TargetParticleCount * context.qualityMultiplier);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.viewport.width,
        y: Math.random() * this.viewport.height,
        size: (Math.random() * 3 + 2) * ((this.config.size as number) || 1),
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20,
        pulsePhase: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 3 + 1,
        baseAlpha: Math.random() * 0.5 + 0.5,
      });
    }
  }

  public update(context: RenderContext): void {
    const speed = (this.config.speed as number) || 1;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.pulsePhase += context.deltaTime * p.pulseSpeed;
      p.x += p.vx * context.deltaTime * speed;
      p.y += p.vy * context.deltaTime * speed;

      if (p.x < -10) p.x = this.viewport.width + 10;
      if (p.x > this.viewport.width + 10) p.x = -10;
      if (p.y < -10) p.y = this.viewport.height + 10;
      if (p.y > this.viewport.height + 10) p.y = -10;
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = (this.config.color as string) || '#CCFF00';

    ctx.save();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const alpha = p.baseAlpha * (0.3 + 0.7 * Math.sin(p.pulsePhase)) * ((this.config.opacity as number) ?? 1);

      if (alpha <= 0) continue;

      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}