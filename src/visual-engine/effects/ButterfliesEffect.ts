import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';

interface Butterfly {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  wingPhase: number;
  wingSpeed: number;
  alpha: number;
}

export class ButterfliesEffect extends BaseEffect<Butterfly> {
  constructor(id?: string) {
    super('butterflies', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.floor(Math.min(25, this.TargetParticleCount * context.qualityMultiplier));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.viewport.width,
        y: Math.random() * this.viewport.height,
        size: (Math.random() * 6 + 6) * ((this.config.size as number) || 1),
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 30,
        wingPhase: Math.random() * Math.PI * 2,
        wingSpeed: Math.random() * 10 + 10,
        alpha: Math.random() * 0.4 + 0.6,
      });
    }
  }

  public update(context: RenderContext): void {
    const speed = (this.config.speed as number) || 1;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.wingPhase += context.deltaTime * p.wingSpeed * speed;
      p.x += p.vx * context.deltaTime * speed;
      p.y += p.vy * context.deltaTime * speed;

      if (context.pointer.isHovered && this.config.interactive) {
        const dx = context.pointer.x - p.x;
        const dy = context.pointer.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          p.vx -= (dx / dist) * 15 * context.deltaTime;
          p.vy -= (dy / dist) * 15 * context.deltaTime;
        }
      }

      if (p.x < 0) p.x = this.viewport.width;
      if (p.x > this.viewport.width) p.x = 0;
      if (p.y < 0) p.y = this.viewport.height;
      if (p.y > this.viewport.height) p.y = 0;
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = (this.config.color as string) || '#E0BBE4';

    ctx.save();
    ctx.fillStyle = color;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const wingScale = Math.abs(Math.sin(p.wingPhase));

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = p.alpha * ((this.config.opacity as number) ?? 1);

      ctx.beginPath();
      ctx.ellipse(-p.size * wingScale * 0.5, 0, p.size * wingScale, p.size * 0.6, -Math.PI / 6, 0, Math.PI * 2);
      ctx.ellipse(p.size * wingScale * 0.5, 0, p.size * wingScale, p.size * 0.6, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }
}