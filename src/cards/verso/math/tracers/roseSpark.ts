import type { CoordinateSystem } from "../coordinates";
import type { Tracer } from "../types";
import { CurveTracer } from "../tracer";

/**
 * "rose_spark" — a warm rose-gold ember with a soft flickering glow.
 *
 * A small glowing point with a warm rose-gold halo that pulses gently,
 * like a tiny ember floating along the curve.
 */
export class RoseSparkTracer extends CurveTracer {
  render(
    ctx: CanvasRenderingContext2D,
    cs: CoordinateSystem,
    time: number,
  ): void {
    const p = cs.worldToScreen(this.position);
    const r = this.size * cs.scale;
    const flicker = 0.8 + Math.sin(time * 4.7) * 0.1 + Math.sin(time * 7.3) * 0.1;

    // Outer warm glow
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
    glow.addColorStop(0, `rgba(255, 200, 180, ${0.8 * flicker})`);
    glow.addColorStop(0.5, `rgba(255, 150, 130, ${0.4 * flicker})`);
    glow.addColorStop(1, "rgba(255, 120, 100, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
    ctx.fill();

    // Middle warm core
    ctx.fillStyle = `rgba(255, 220, 200, ${0.9 * flicker})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Hot center
    ctx.fillStyle = `rgba(255, 255, 240, ${0.95 * flicker})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createRoseSpark(
  t0: number,
  position: { x: number; y: number },
  options: { size: number },
): Tracer {
  return new RoseSparkTracer(t0, position, options);
}