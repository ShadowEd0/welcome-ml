/**
 * "ink_trace" — the trajectory resembles a fine line of ink that slowly
 * dissolves. Organic fade, slightly irregular, luminous.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface TrailPoint extends WorldPoint {
  age: number;
  offset: number; // small random offset for organic feel
}

export class InkTraceTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly points: TrailPoint[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number; width?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 70;
    this.baseOpacity = options.baseOpacity ?? 0.55;
    this._opacity = 1;
  }

  get opacity(): number {
    return this._opacity;
  }

  record(point: WorldPoint, time: number): void {
    this.points.push({
      x: point.x,
      y: point.y,
      age: time,
      offset: (Math.random() - 0.5) * 0.008,
    });
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
    if (pts.length < 2) return;

    const now = pts[pts.length - 1].age;
    const oldest = pts[0].age;
    const span = Math.max(now - oldest, 0.001);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.2;

    // Draw with slight offset for organic "bleeding ink" feel
    for (let i = 1; i < pts.length; i++) {
      const p0w = pts[i - 1];
      const p1w = pts[i];
      const p0 = cs.worldToScreen({ x: p0w.x + p0w.offset, y: p0w.y + p0w.offset });
      const p1 = cs.worldToScreen({ x: p1w.x + p1w.offset, y: p1w.y + p1w.offset });
      const fade = (p1w.age - oldest) / span;
      // Quadratic fade for "dissolving" feel
      const dissolve = fade * fade;
      ctx.globalAlpha = this.baseOpacity * dissolve * this._opacity;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function createInkTrace(
  color: string,
  options?: { capacity?: number; baseOpacity?: number }
): InkTraceTrail {
  return new InkTraceTrail(color, options);
}