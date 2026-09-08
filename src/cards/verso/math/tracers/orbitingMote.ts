import type { CoordinateSystem } from "../coordinates";
import type { Tracer } from "../types";
import { CurveTracer } from "../tracer";

/**
 * "orbiting_mote" — a tiny luminous speck with a faint orbital ring.
 *
 * A small bright core surrounded by a thin elliptical ring that slowly
 * rotates around it, suggesting a miniature orbiting body.
 */
export class OrbitingMoteTracer extends CurveTracer {
  render(
    ctx: CanvasRenderingContext2D,
    cs: CoordinateSystem,
    time: number,
  ): void {
    const p = cs.worldToScreen(this.position);
    const r = this.size * cs.scale;
    const pulse = 0.85 + Math.sin(time * 2.2) * 0.15;

    // Orbital ring
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(time * 0.6);
    ctx.scale(1, 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(200, 220, 255, ${0.35 * pulse})`;
    ctx.lineWidth = Math.max(0.5, r * 0.06);
    ctx.stroke();
    ctx.restore();

    // Core glow
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.5);
    glow.addColorStop(0, `rgba(220, 235, 255, ${0.9 * pulse})`);
    glow.addColorStop(1, "rgba(220, 235, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * pulse})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createOrbitingMote(
  t0: number,
  position: { x: number; y: number },
  options: { size: number },
): Tracer {
  return new OrbitingMoteTracer(t0, position, options);
}