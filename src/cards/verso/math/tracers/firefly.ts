import type { CoordinateSystem } from "../coordinates";
import { CurveTracer } from "../tracer";

/**
 * "firefly" — a tiny pulsing light with a warm glow that breathes in
 * intensity. The pulse is driven by the provided time, no internal clock.
 */
export class Firefly extends CurveTracer {
  constructor(t0: number, position: { x: number; y: number }, options?: { size?: number }) {
    super(t0, position, options);
  }

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, time: number): void {
    const p = cs.worldToScreen(this.position);
    const r = this.size * cs.scale;

    // Pulse: two overlapping sine waves for organic feel
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.1);
    const micro = 0.8 + 0.2 * Math.sin(time * 7.3);
    const intensity = pulse * micro;

    // Outer soft glow
    const glowR = r * (2.5 + intensity * 1.5);
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
    glow.addColorStop(0, `rgba(255, 240, 150, ${0.6 * intensity})`);
    glow.addColorStop(0.5, `rgba(255, 200, 80, ${0.2 * intensity})`);
    glow.addColorStop(1, "rgba(255, 180, 60, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = `rgba(255, 255, 220, ${0.7 + intensity * 0.3})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * (0.4 + intensity * 0.2), 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createFirefly(
  t0: number,
  position: { x: number; y: number },
  options?: { size?: number },
): Firefly {
  return new Firefly(t0, position, options);
}
