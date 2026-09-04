import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  alpha: number;
  active: boolean;
  timer: number;
}

export class ShootingStarsEffect extends BaseEffect<ShootingStar> {
  constructor(id?: string) {
    super('shooting_stars', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.max(1, Math.floor(5 * context.qualityMultiplier));
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this.resetStar({} as ShootingStar, false));
    }
  }

  private resetStar(star: Partial<ShootingStar>, active = true): ShootingStar {
    star.x = Math.random() * this.viewport.width * 1.2 - this.viewport.width * 0.1;
    star.y = Math.random() * (this.viewport.height * 0.5);
    star.length = Math.random() * 80 + 40;
    star.speed = Math.random() * 400 + 400;
    star.angle = Math.PI / 4 + (Math.random() * 0.2 - 0.1);
    star.alpha = Math.random() * 0.5 + 0.5;
    star.active = active;
    star.timer = Math.random() * 5 + 2;
    return star as ShootingStar;
  }

  public update(context: RenderContext): void {
    const speedMult = (this.config.speed as number) || 1;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.timer -= context.deltaTime;
        if (p.timer <= 0) {
          this.resetStar(p, true);
        }
        continue;
      }

      p.x += Math.cos(p.angle) * p.speed * speedMult * context.deltaTime;
      p.y += Math.sin(p.angle) * p.speed * speedMult * context.deltaTime;

      if (p.x > this.viewport.width + 100 || p.y > this.viewport.height + 100) {
        p.active = false;
        p.timer = Math.random() * 8 + 3;
      }
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = (this.config.color as string) || '#FFFFFF';

    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;

      const tailX = p.x - Math.cos(p.angle) * p.length;
      const tailY = p.y - Math.sin(p.angle) * p.length;

      const grad = ctx.createLinearGradient(p.x, p.y, tailX, tailY);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');

      ctx.strokeStyle = grad;
      ctx.lineWidth = (this.config.size as number) || 2;
      ctx.globalAlpha = p.alpha;

      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    }
    ctx.restore();
  }
}