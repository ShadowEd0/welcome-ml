/**
 * "vanishing_glow" — not a line, but a soft luminous imprint of the recent
 * path that fades progressively. Very atmospheric, ideal for dark universes.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface GlowPoint extends WorldPoint {
  age: number;
}

export class VanishingGlowTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly widthWorld: number;
  private readonly points: GlowPoint[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number; widthWorld?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 50;
    this.baseOpacity = options.baseOpacity ?? 0.5;
    // Width of the soft band in world units. The default (6) matches the
    // original behaviour; scenes that run on large world geometry (e.g. a
    // cardioid spanning radius 2) must pass a width proportional to their
    // shape or the glow floods the whole card.
    this.widthWorld = options.widthWorld ?? 6;
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

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, _time: number): void {
    const pts = this.points;
    if (pts.length < 2) return;

    const now = pts[pts.length - 1].age;
    const oldest = pts[0].age;
    const span = Math.max(now - oldest, 0.001);

    ctx.save();

    // Draw a wide, soft glow under the path
    for (let i = 1; i < pts.length; i++) {
      const p0 = cs.worldToScreen(pts[i - 1]);
      const p1 = cs.worldToScreen(pts[i]);
      const fade = (pts[i].age - oldest) / span;
      // Wide, soft stroke for "glow" feel (world units × screen scale)
      const width = this.widthWorld * cs.scale * fade;
      ctx.globalAlpha = this.baseOpacity * fade * 0.3 * this._opacity;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    // Draw a thinner bright core on top
    for (let i = 1; i < pts.length; i++) {
      const p0 = cs.worldToScreen(pts[i - 1]);
      const p1 = cs.worldToScreen(pts[i]);
      const fade = (pts[i].age - oldest) / span;
      ctx.globalAlpha = this.baseOpacity * fade * this._opacity;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.widthWorld * cs.scale * fade * 0.25;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export function createVanishingGlow(
  color: string,
  options?: { capacity?: number; baseOpacity?: number; widthWorld?: number }
): VanishingGlowTrail {
  return new VanishingGlowTrail(color, options);
}