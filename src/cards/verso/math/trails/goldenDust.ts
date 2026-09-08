/**
 * "golden_dust" — the tracer leaves behind a fine golden dust of tiny
 * luminous points. Not a particle system: just a few discrete motes that
 * fade with age.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface DustMote extends WorldPoint {
  age: number;
  size: number;
}

export class GoldenDustTrail implements Trail {
  private readonly capacity: number;
  private readonly points: DustMote[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 50;
    this._opacity = options.baseOpacity ?? 0.7;
  }

  get opacity(): number {
    return this._opacity;
  }

  record(point: WorldPoint, time: number): void {
    // Only record every few frames to avoid density
    if (this.points.length === 0 || time - this.points[this.points.length - 1].age > 0.05) {
      this.points.push({
        x: point.x,
        y: point.y,
        age: time,
        size: 0.003 + Math.random() * 0.004,
      });
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
    for (const mote of pts) {
      const p = cs.worldToScreen(mote);
      const fade = (mote.age - oldest) / span;
      const r = mote.size * cs.scale;
      ctx.globalAlpha = this._opacity * fade * fade;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function createGoldenDust(
  color: string,
  options?: { capacity?: number; baseOpacity?: number }
): GoldenDustTrail {
  return new GoldenDustTrail(color, options);
}