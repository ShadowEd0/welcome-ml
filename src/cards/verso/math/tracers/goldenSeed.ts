/**
 * Math Verso Engine — Golden Seed tracer.
 *
 * A warm, seed-like point of golden light with a subtle inner spark.
 * Suggests a tiny ember drifting along the curve. The spark rotates
 * slowly, giving life without motion.
 */

import type { CoordinateSystem } from "../coordinates";
import { CurveTracer } from "../tracer";
import type { TracerOptions } from "../tracer";

export interface GoldenSeedOptions extends TracerOptions {
  color?: string;
}

export class GoldenSeedTracer extends CurveTracer {
  private readonly color: string;

  constructor(t0 = 0, position: { x: number; y: number } = { x: 0, y: 0 }, options: GoldenSeedOptions = {}) {
    super(t0, position, options);
    this.color = options.color ?? "#f0c060";
  }

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, time: number): void {
    const p = cs.worldToScreen(this.position);
    const baseR = this.size * cs.scale;
    const pulse = 0.85 + 0.15 * Math.sin(time * 2.5);

    ctx.save();

    // Warm halo
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, baseR * 3.5);
    glow.addColorStop(0, this.color);
    glow.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.4 * pulse;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, baseR * 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Inner seed (slightly elongated)
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#fff0c0";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, baseR * 0.5, baseR * 0.35, time * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Tiny spark
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(p.x, p.y, baseR * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export function createGoldenSeedTracer(
  t0 = 0,
  position: { x: number; y: number } = { x: 0, y: 0 },
  options: GoldenSeedOptions = {}
): GoldenSeedTracer {
  return new GoldenSeedTracer(t0, position, options);
}
