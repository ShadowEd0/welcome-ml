/**
 * "light_echo" — the tracer leaves several faint luminous echoes behind it.
 * Each echo is a thin, fading ring that expands slightly.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface EchoPoint extends WorldPoint {
  age: number;
}

export class LightEchoTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly points: EchoPoint[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 40;
    this.baseOpacity = options.baseOpacity ?? 0.45;
    this._opacity = 1;
  }

  get opacity(): number {
    return this._opacity;
  }

  record(point: WorldPoint, time: number): void {
    // Record sparsely to create distinct echoes
    if (this.points.length === 0 || time - this.points[this.points.length - 1].age > 0.08) {
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
    for (const echo of pts) {
      const p = cs.worldToScreen(echo);
      const fade = (echo.age - oldest) / span;
      // Echo expands slightly with age
      const r = (0.01 + (1 - fade) * 0.03) * cs.scale;
      ctx.globalAlpha = this.baseOpacity * fade * this._opacity;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function createLightEcho(
  color: string,
  options?: { capacity?: number; baseOpacity?: number }
): LightEchoTrail {
  return new LightEchoTrail(color, options);
}