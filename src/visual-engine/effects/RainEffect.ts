import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';

interface RainDrop {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
}

export class RainEffect extends BaseEffect<RainDrop> {
  constructor(id?: string) {
    super('rain', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.floor(this.TargetParticleCount * 2 * context.qualityMultiplier);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.viewport.width,
        y: Math.random() * this.viewport.height,
        length: Math.random() * 20 + 10,
        speed: Math.random() * 400 + 600,
        alpha: Math.random() * 0.4 + 0.2,
      });
    }
  }

  public update(context: RenderContext): void {
    const speed = (this.config.speed as number) || 1;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.y += p.speed * speed * context.deltaTime;
      p.x -= p.speed * 0.1 * speed * context.deltaTime;

      if (p.y > this.viewport.height) {
        p.y = -p.length;
        p.x = Math.random() * (this.viewport.width + 100);
      }
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = (this.config.color as string) || '#A4C2F4';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = (this.config.size as number) || 1.2;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.globalAlpha = p.alpha * ((this.config.opacity as number) ?? 1);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.length * 0.1, p.y + p.length);
      ctx.stroke();
    }
    ctx.restore();
  }
}