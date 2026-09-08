/**
 * "silk_ribbon" — a smooth, continuous ribbon of light that follows the
 * recent trajectory. Slightly variable in width, soft and elegant.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface TrailPoint extends WorldPoint {
  age: number;
}

export class SilkRibbonTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly points: TrailPoint[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number; width?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 60;
    this.baseOpacity = options.baseOpacity ?? 0.5;
    this._opacity = 1;
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

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, time: number): void {
    const pts = this.points;
    if (pts.length < 3) return;

    const now = pts[pts.length - 1].age;
    const oldest = pts[0].age;
    const span = Math.max(now - oldest, 0.001);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = this.color;

    // Draw as a smooth curve through midpoints (Catmull-Rom-ish)
    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = cs.worldToScreen(pts[i - 1]);
      const p1 = cs.worldToScreen(pts[i]);
      const p2 = cs.worldToScreen(pts[i + 1]);
      const fade = (pts[i].age - oldest) / span;
      // Width varies slightly with time for "silk" feel
      const widthMod = 1 + 0.3 * Math.sin(time * 2 + i * 0.3);
      ctx.globalAlpha = this.baseOpacity * fade * this._opacity;
      ctx.lineWidth = 2 * widthMod * fade;
      ctx.beginPath();
      ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
      ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function createSilkRibbon(
  color: string,
  options?: { capacity?: number; baseOpacity?: number }
): SilkRibbonTrail {
  return new SilkRibbonTrail(color, options);
}