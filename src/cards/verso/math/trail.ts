/**
 * Math Verso Engine — trail abstraction.
 *
 * A trail is a fading history of recent tracer positions. It decouples
 * the visual "wake" from the tracer itself, so trails are interchangeable
 * plugins. This module provides one default implementation; future trails
 * (silk, nebula, crystal, …) implement the same contract.
 */

import type { CoordinateSystem } from "./coordinates";
import type { Trail, WorldPoint } from "./types";

export interface TrailOptions {
  /** Maximum number of recent points to keep. */
  capacity?: number;
  /** Base opacity of the freshest point (0..1). */
  baseOpacity?: number;
  /** Width of the trail stroke in pixels (screen units). */
  width?: number;
}

interface TrailPoint extends WorldPoint {
  age: number;
}

/**
 * A fading polyline trail.
 *
 * Each frame the scene calls `record` with the tracer's position. Older
 * points fade out; the trail is drawn as a tapering, fading stroke.
 */
export class FadingPolylineTrail implements Trail {
  private readonly capacity: number;
  private readonly baseOpacity: number;
  private readonly width: number;
  private readonly points: TrailPoint[] = [];
  private readonly color: string;
  private _opacity = 1;

  constructor(color: string, options: TrailOptions = {}) {
    this.color = color;
    this.capacity = options.capacity ?? 60;
    this.baseOpacity = options.baseOpacity ?? 0.7;
    this.width = options.width ?? 2;
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

    // Draw segment by segment so each fades with its age.
    for (let i = 1; i < pts.length; i++) {
      const p0w = pts[i - 1];
      const p1w = pts[i];
      const p0 = cs.worldToScreen(p0w);
      const p1 = cs.worldToScreen(p1w);
      const fade = (p1w.age - oldest) / span;
      ctx.globalAlpha = this.baseOpacity * fade * this._opacity;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }

    ctx.restore();
  }
}

/** A trail that renders nothing — useful when trails are disabled. */
export class NoTrail implements Trail {
  get opacity(): number {
    return 0;
  }
  record(): void {}
  clear(): void {}
  render(): void {}
}
