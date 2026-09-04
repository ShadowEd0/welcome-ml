import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';

interface AmbientParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  alpha: number;
}

export class ParticlesEffect extends BaseEffect<AmbientParticle> {
  constructor(id?: string) {
    super('particles', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.floor(this.TargetParticleCount * context.qualityMultiplier);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.viewport.width,
        y: Math.random() * this.viewport.height,
        size: (Math.random() * 2 + 1) * ((this.config.size as number) || 1),
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        alpha: Math.random() * 0.5 + 0.2,
      });
    }
  }

  public update(context: RenderContext): void {
    const speed = (this.config.speed as number) || 1;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * speed * context.deltaTime;
      p.y += p.vy * speed * context.deltaTime;

      if (p.x < 0) p.x = this.viewport.width;
      if (p.x > this.viewport.width) p.x = 0;
      if (p.y < 0) p.y = this.viewport.height;
      if (p.y > this.viewport.height) p.y = 0;
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = (this.config.color as string) || '#FFFFFF';

    ctx.save();
    ctx.fillStyle = color;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.globalAlpha = p.alpha * ((this.config.opacity as number) ?? 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}