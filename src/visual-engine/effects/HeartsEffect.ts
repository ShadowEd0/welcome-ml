import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';

interface Heart {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  oscillationSpeed: number;
  oscillationAmplitude: number;
  phase: number;
  alpha: number;
  rotation: number;
}

export class HeartsEffect extends BaseEffect<Heart> {
  constructor(id?: string) {
    super('hearts', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.floor(this.TargetParticleCount * context.qualityMultiplier);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createHeart(true));
    }
  }

  private createHeart(randomY = false): Heart {
    return {
      x: Math.random() * this.viewport.width,
      y: randomY ? Math.random() * this.viewport.height : this.viewport.height + 20,
      size: (Math.random() * 12 + 8) * ((this.config.size as number) || 1),
      speedY: Math.random() * 30 + 20,
      speedX: 0,
      oscillationSpeed: Math.random() * 2 + 1,
      oscillationAmplitude: Math.random() * 20 + 10,
      phase: Math.random() * Math.PI * 2,
      alpha: Math.random() * 0.5 + 0.5,
      rotation: (Math.random() - 0.5) * 0.4,
    };
  }

  public update(context: RenderContext): void {
    const speed = (this.config.speed as number) || 1;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.phase += context.deltaTime * p.oscillationSpeed;
      p.y -= p.speedY * speed * context.deltaTime;
      p.x += Math.sin(p.phase) * p.oscillationAmplitude * context.deltaTime;

      if (p.y < -30) {
        Object.assign(p, this.createHeart(false));
      }
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = (this.config.color as string) || '#FF69B4';

    ctx.save();
    ctx.fillStyle = color;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha * ((this.config.opacity as number) ?? 1);

      ctx.beginPath();
      const topCurveHeight = p.size * 0.3;
      ctx.moveTo(0, topCurveHeight);
      ctx.bezierCurveTo(0, 0, -p.size / 2, 0, -p.size / 2, topCurveHeight);
      ctx.bezierCurveTo(-p.size / 2, (p.size + topCurveHeight) / 2, 0, p.size, 0, p.size);
      ctx.bezierCurveTo(0, p.size, p.size / 2, (p.size + topCurveHeight) / 2, p.size / 2, topCurveHeight);
      ctx.bezierCurveTo(p.size / 2, 0, 0, 0, 0, topCurveHeight);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }
}