/**
 * Math Verso Engine — Luminous Point tracer.
 *
 * A soft, pulsing glow of pure light. The simplest tracer: a radiant
 * point that breathes gently without ever stealing attention from the
 * curve. Its brightness oscillates slowly with the provided time.
 */

import type { CoordinateSystem } from "../coordinates";
import { CurveTracer } from "../tracer";
import type { TracerOptions } from "../tracer";

export interface LuminousPointOptions extends TracerOptions {
  color?: string;
}

export class LuminousPointTracer extends CurveTracer {
  private readonly color: string;

  constructor(t0 = 0, position: { x: number; y: number } = { x: 0, y: 0 }, options: LuminousPointOptions = {}) {
    super(t0, position, options);
    this.color = options.color ?? "#ffffff";
  }

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, time: number): void {
    const p = cs.worldToScreen(this.position);
    const baseR = this.size * cs.scale;
    // Gentle breathing pulse: brightness oscillates between 0.6 and 1.0
    const pulse = 0.8 + 0.2 * Math.sin(time * 2.0);

    ctx.save();

    // Outer halo
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, baseR * 4);
    glow.addColorStop(0, this.color);
    glow.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.35 * pulse;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, baseR * 4, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, baseR * 0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export function createLuminousPointTracer(
  t0 = 0,
  position: { x: number; y: number } = { x: 0, y: 0 },
  options: LuminousPointOptions = {}
): LuminousPointTracer {
  return new LuminousPointTracer(t0, position, options);
}
