import { BaseEffect } from '../BaseEffect';
import { RenderContext } from '../types';

interface Petal {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
  oscillationPhase: number;
  alpha: number;
}

export class PetalsEffect extends BaseEffect<Petal> {
  constructor(id?: string) {
    super('petals', id);
  }

  protected initPool(context: RenderContext): void {
    const count = Math.floor(this.TargetParticleCount * context.qualityMultiplier);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this.createPetal(true));
    }
  }

  private createPetal(randomY = false): Petal {
    return {
      x: Math.random() * this.viewport.width,
      y: randomY ? Math.random() * this.viewport.height : -20,
      size: (Math.random() * 8 + 6) * ((this.config.size as number) || 1),
      speedX: Math.random() * 20 - 10,
      speedY: Math.random() * 40 + 30,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 2,
      oscillationPhase: Math.random() * Math.PI * 2,
      alpha: Math.random() * 0.4 + 0.6,
    };
  }

  public update(context: RenderContext): void {
    const speed = (this.config.speed as number) || 1;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.oscillationPhase += context.deltaTime * 1.5;
      p.x += (p.speedX + Math.sin(p.oscillationPhase) * 25) * context.deltaTime * speed;
      p.y += p.speedY * context.deltaTime * speed;
      p.rotation += p.rotationSpeed * context.deltaTime;

      if (p.y > this.viewport.height + 20 || p.x < -30 || p.x > this.viewport.width + 30) {
        Object.assign(p, this.createPetal(false));
      }
    }
  }

  public render(context: RenderContext): void {
    const { ctx } = context;
    const color = (this.config.color as string) || '#FFB7C5';

    ctx.save();
    ctx.fillStyle = color;

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.alpha * ((this.config.opacity as number) ?? 1);

      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }
}