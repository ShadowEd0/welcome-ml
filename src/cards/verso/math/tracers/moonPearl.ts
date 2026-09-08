import type { CoordinateSystem } from "../coordinates";
import { CurveTracer } from "../tracer";

/**
 * "moon_pearl" — a small luminous sphere with a crescent shadow, evoking
 * a tiny moon. The "phase" shifts slowly with time for subtle life.
 */
export class MoonPearl extends CurveTracer {
  constructor(t0: number, position: { x: number; y: number }, options?: { size?: number }) {
    super(t0, position, options);
  }

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, time: number): void {
    const p = cs.worldToScreen(this.position);
    const r = this.size * cs.scale;

    // Glow
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
    glow.addColorStop(0, "rgba(240, 240, 255, 0.5)");
    glow.addColorStop(1, "rgba(220, 220, 240, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Full moon base
    const base = ctx.createRadialGradient(p.x - r * 0.2, p.y - r * 0.2, 0, p.x, p.y, r);
    base.addColorStop(0, "rgba(255, 255, 250, 0.95)");
    base.addColorStop(1, "rgba(220, 220, 230, 0.8)");
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Crescent shadow (phase shifts slowly)
    const phase = (Math.sin(time * 0.4) + 1) / 2; // 0..1
    const offsetX = r * 0.6 * (phase - 0.5) * 2;
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(p.x + offsetX, p.y, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fill();
    ctx.restore();

    // Subtle rim light
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, -Math.PI * 0.3, Math.PI * 0.7);
    ctx.stroke();
  }
}

export function createMoonPearl(
  t0: number,
  position: { x: number; y: number },
  options?: { size?: number },
): MoonPearl {
  return new MoonPearl(t0, position, options);
}
