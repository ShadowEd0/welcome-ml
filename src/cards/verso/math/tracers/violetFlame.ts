import type { CoordinateSystem } from "../coordinates";
import { CurveTracer } from "../tracer";

/**
 * "violet_flame" — a small teardrop flame in violet/magenta tones. The
 * flame shape is stable but its internal gradient shimmers with time.
 */
export class VioletFlame extends CurveTracer {
  constructor(t0: number, position: { x: number; y: number }, options?: { size?: number }) {
    super(t0, position, options);
  }

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, time: number): void {
    const p = cs.worldToScreen(this.position);
    const r = this.size * cs.scale;

    // Flicker factor
    const flicker = 0.85 + 0.15 * Math.sin(time * 8) * Math.sin(time * 3.7);

    // Outer glow
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.5);
    glow.addColorStop(0, `rgba(200, 150, 255, ${0.4 * flicker})`);
    glow.addColorStop(1, "rgba(150, 100, 200, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Flame body (teardrop)
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(1, flicker);

    ctx.beginPath();
    ctx.moveTo(0, -r * 1.4);
    ctx.bezierCurveTo(r * 0.7, -r * 0.5, r * 0.6, r * 0.5, 0, r * 0.7);
    ctx.bezierCurveTo(-r * 0.6, r * 0.5, -r * 0.7, -r * 0.5, 0, -r * 1.4);
    ctx.closePath();

    const flameGrad = ctx.createLinearGradient(0, -r * 1.4, 0, r * 0.7);
    flameGrad.addColorStop(0, "rgba(255, 220, 255, 0.95)");
    flameGrad.addColorStop(0.5, "rgba(200, 130, 240, 0.9)");
    flameGrad.addColorStop(1, "rgba(140, 80, 200, 0.7)");
    ctx.fillStyle = flameGrad;
    ctx.fill();

    // Inner hot core
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.bezierCurveTo(r * 0.3, -r * 0.2, r * 0.25, r * 0.2, 0, r * 0.3);
    ctx.bezierCurveTo(-r * 0.25, r * 0.2, -r * 0.3, -r * 0.2, 0, -r * 0.6);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 240, 0.85)";
    ctx.fill();

    ctx.restore();
  }
}

export function createVioletFlame(
  t0: number,
  position: { x: number; y: number },
  options?: { size?: number },
): VioletFlame {
  return new VioletFlame(t0, position, options);
}
