import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';

interface MistCloud {
  x: number;
  y: number;
  radius: number;
  vx: number;
  alpha: number;
}

export class MistEffect extends BaseEffect<MistCloud> {
  constructor(id?: string) {
    super('mist', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.max(4, Math.floor(10 * context.qualityMultiplier));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.viewport.width,
        y: this.viewport.height * (0.4 + Math.random() * 0.6),
        radius: Math.random() * 200 + 150,
        vx: Math.random() * 15 + 5,
        alpha: Math.random() * 0.15 + 0.05,
      });
    }
  }

  public update(context: RenderContext): void {
    const speed = (this.config.speed as number) || 1;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx * speed * context.deltaTime;
      if (p.x - p.radius > this.viewport.width) {
        p.x = -p.radius;
      }
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = (this.config.color as string) || '#FFFFFF';

    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');

      ctx.globalAlpha = p.alpha * ((this.config.opacity as number) ?? 1);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}