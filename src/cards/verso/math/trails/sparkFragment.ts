/**
 * "spark_fragment" — the trajectory leaves a few short luminous fragments
 * along the path. Small segments with slight size variation that fade out.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface Fragment extends WorldPoint {
  age: number;
  len: number;
  angle: number;
}

export class SparkFragmentTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly points: Fragment[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 35;
    this.baseOpacity = options.baseOpacity ?? 0.6;
    this._opacity = 1;
  }

  get opacity(): number {
    return this._opacity;
  }

  record(point: WorldPoint, time: number): void {
    if (this.points.length === 0 || time - this.points[this.points.length - 1].age > 0.06) {
      this.points.push({
        x: point.x,
        y: point.y,
        age: time,
        len: 0.01 + Math.random() * 0.015,
        angle: Math.random() * Math.PI * 2,
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
    ctx.strokeStyle = this.color;
    ctx.lineCap = "round";
    ctx.lineWidth = 1.5;

    for (const frag of pts) {
      const p = cs.worldToScreen(frag);
      const fade = (frag.age - oldest) / span;
      ctx.globalAlpha = this.baseOpacity * fade * this._opacity;
      const l = frag.len * cs.scale;
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(frag.angle) * l, p.y - Math.sin(frag.angle) * l);
      ctx.lineTo(p.x + Math.cos(frag.angle) * l, p.y + Math.sin(frag.angle) * l);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function createSparkFragment(
  color: string,
  options?: { capacity?: number; baseOpacity?: number }
): SparkFragmentTrail {
  return new SparkFragmentTrail(color, options);
}