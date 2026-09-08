/**
 * "fading_line" — a thin luminous line that follows the tracer and fades
 * progressively behind it. The reference trail: elegant, continuous, thin.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface TrailPoint extends WorldPoint {
  age: number;
}

export class FadingLineTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly width: number;
  private readonly points: TrailPoint[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number; width?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 80;
    this.baseOpacity = options.baseOpacity ?? 0.6;
    this.width = options.width ?? 1.5;
  }

  get opacity(): number {
    return this._opacity;
  }

  record(point: WorldPoint, time: number): void {
    this.points.push({ x: point.x, y: point.y, age: time });
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
    ctx.lineWidth = this.width;

    for (let i = 1; i < pts.length; i++) {
      const p0 = cs.worldToScreen(pts[i - 1]);
      const p1 = cs.worldToScreen(pts[i]);
      const fade = (pts[i].age - oldest) / span;
      ctx.globalAlpha = this.baseOpacity * fade * this._opacity;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function createFadingLine(
  color: string,
  options?: { capacity?: number; baseOpacity?: number; width?: number }
): FadingLineTrail {
  return new FadingLineTrail(color, options);
}