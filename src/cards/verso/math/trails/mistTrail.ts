/**
 * "mist_trail" — a very light, diffuse mist follows the trajectory.
 * Soft, airy, and discrete. Uses overlapping translucent circles.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface MistPoint extends WorldPoint {
  age: number;
}

export class MistTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly points: MistPoint[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 45;
    this.baseOpacity = options.baseOpacity ?? 0.35;
    this._opacity = 1;
  }

  get opacity(): number {
    return this._opacity;
  }

  record(point: WorldPoint, time: number): void {
    if (this.points.length === 0 || time - this.points[this.points.length - 1].age > 0.07) {
      this.points.push({ x: point.x, y: point.y, age: time });
    }
    if (this.points.length > this.capacity) {
      this.points.shift();
    }
  }

  clear(): void {
    this.points.length = 0;
    this._opacity = 1;
  }

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, _time: number): void {
    const pts = this.points;
    if (pts.length === 0) return;

    const now = pts[pts.length - 1].age;
    const oldest = pts[0].age;
    const span = Math.max(now - oldest, 0.001);

    ctx.save();
    for (const mist of pts) {
      const p = cs.worldToScreen(mist);
      const fade = (mist.age - oldest) / span;
      // Large soft circle for "mist" feel
      const r = 0.02 * cs.scale * (0.5 + (1 - fade) * 0.5);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, this.color);
      grad.addColorStop(1, "transparent");
      ctx.globalAlpha = this.baseOpacity * fade * this._opacity * 0.5;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function createMistTrail(
  color: string,
  options?: { capacity?: number; baseOpacity?: number }
): MistTrail {
  return new MistTrail(color, options);
}