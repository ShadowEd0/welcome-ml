import type { CoordinateSystem } from "../coordinates";
import { CurveTracer } from "../tracer";

/**
 * "comet_spark" — a luminous core with a short, fading tail trailing
 * opposite to motion. The tail is purely visual (not the curve trail):
 * a small gradient streak that gives directionality.
 */
export class CometSpark extends CurveTracer {
  constructor(t0: number, position: { x: number; y: number }, options?: { size?: number }) {
    super(t0, position, options);
  }

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, time: number): void {
    const p = cs.worldToScreen(this.position);
    const r = this.size * cs.scale;

    // Tail (streak trailing behind, length pulses subtly)
    const tailLen = r * (3 + 0.5 * Math.sin(time * 4));
    const tail = ctx.createLinearGradient(p.x, p.y, p.x - tailLen, p.y);
    tail.addColorStop(0, "rgba(255, 220, 160, 0.7)");
    tail.addColorStop(1, "rgba(255, 180, 100, 0)");
    ctx.strokeStyle = tail;
    ctx.lineWidth = r * 0.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - tailLen, p.y);
    ctx.stroke();

    // Core glow
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.5);
    glow.addColorStop(0, "rgba(255, 230, 180, 0.9)");
    glow.addColorStop(0.4, "rgba(255, 200, 120, 0.4)");
    glow.addColorStop(1, "rgba(255, 160, 80, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Hot core
    ctx.fillStyle = "#fff8e0";
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createCometSpark(
  t0: number,
  position: { x: number; y: number },
  options?: { size?: number },
): CometSpark {
  return new CometSpark(t0, position, options);
}
