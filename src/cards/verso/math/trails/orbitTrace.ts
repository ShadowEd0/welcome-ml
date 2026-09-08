/**
 * "orbit_trace" — the passage leaves a slightly undulating/orbital memory
 * around the trajectory. Very subtle, suggests local oscillation without
 * distorting the true function.
 */

import type { CoordinateSystem } from "../coordinates";
import type { Trail, WorldPoint } from "../types";

interface OrbitPoint extends WorldPoint {
  age: number;
  phase: number;
}

export class OrbitTraceTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly points: OrbitPoint[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: { capacity?: number; baseOpacity?: number } = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 55;
    this.baseOpacity = options.baseOpacity ?? 0.4;
    this._opacity = 1;
  }

  get opacity(): number {
    return this._opacity;
  }

  record(point: WorldPoint, time: number): void {
    this.points.push({ x: point.x, y: point.y, age: time, phase: Math.random() * Math.PI * 2 });
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
    if (pts.length < 2) return;

    const now = pts[pts.length - 1].age;
    const oldest = pts[0].age;
    const span = Math.max(now - oldest, 0.001);

    ctx.save();
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;

    // Draw the main path with a subtle orbital offset
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const fade = (p.age - oldest) / span;
      // Subtle oscillation perpendicular to motion
      const osc = Math.sin(time * 3 + p.phase) * 0.005 * cs.scale * fade;
      const screen = cs.worldToScreen(p);
      const x = screen.x + osc;
      const y = screen.y + osc;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.globalAlpha = this.baseOpacity * this._opacity;
    ctx.stroke();

    ctx.restore();
  }
}

export function createOrbitTrace(
  color: string,
  options?: { capacity?: number; baseOpacity?: number }
): OrbitTraceTrail {
  return new OrbitTraceTrail(color, options);
}