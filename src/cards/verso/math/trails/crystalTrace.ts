/**
 * "crystal_trace" — the passage creates temporary small crystalline segments
 * along the path. Very geometric, they appear and then fade out.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface CrystalSegment extends WorldPoint {
  age: number;
  size: number;
  rotation: number;
}

export class CrystalTraceTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly points: CrystalSegment[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 30;
    this.baseOpacity = options.baseOpacity ?? 0.6;
    this._opacity = 1;
  }

  get opacity(): number {
    return this._opacity;
  }

  record(point: WorldPoint, time: number): void {
    if (this.points.length === 0 || time - this.points[this.points.length - 1].age > 0.09) {
      this.points.push({
        x: point.x,
        y: point.y,
        age: time,
        size: 0.008 + Math.random() * 0.008,
        rotation: Math.random() * Math.PI,
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
    for (const crystal of pts) {
      const p = cs.worldToScreen(crystal);
      const fade = (crystal.age - oldest) / span;
      const s = crystal.size * cs.scale;
      ctx.globalAlpha = this.baseOpacity * fade * this._opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(crystal.rotation);
      // Small diamond
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.6, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.6, 0);
      ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
      // Re-apply DPR transform
      ctx.save();
    }
    ctx.restore();
  }
}

export function createCrystalTrace(
  color: string,
  options?: { capacity?: number; baseOpacity?: number }
): CrystalTraceTrail {
  return new CrystalTraceTrail(color, options);
}