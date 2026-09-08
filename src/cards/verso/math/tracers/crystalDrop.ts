import type { CoordinateSystem } from "../coordinates";
import { CurveTracer } from "../tracer";

/**
 * "crystal_drop" — a faceted gem-like shape with internal facets and a
 * subtle prismatic shimmer. Static geometry, only the shimmer animates.
 */
export class CrystalDrop extends CurveTracer {
  constructor(t0: number, position: { x: number; y: number }, options?: { size?: number }) {
    super(t0, position, options);
  }

  render(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, time: number): void {
    const p = cs.worldToScreen(this.position);
    const r = this.size * cs.scale;

    // Outer glow
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2);
    glow.addColorStop(0, "rgba(200, 220, 255, 0.5)");
    glow.addColorStop(1, "rgba(180, 200, 240, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
    ctx.fill();

    // Faceted diamond shape (two kite halves)
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(time * 0.3); // slow rotation

    // Top facet
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.6, 0);
    ctx.lineTo(0, r * 0.3);
    ctx.lineTo(-r * 0.6, 0);
    ctx.closePath();
    const topGrad = ctx.createLinearGradient(0, -r, 0, r * 0.3);
    topGrad.addColorStop(0, "rgba(230, 240, 255, 0.95)");
    topGrad.addColorStop(1, "rgba(180, 200, 230, 0.7)");
    ctx.fillStyle = topGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Bottom facet
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, 0);
    ctx.lineTo(0, r * 0.3);
    ctx.lineTo(r * 0.6, 0);
    ctx.lineTo(0, r);
    ctx.closePath();
    const botGrad = ctx.createLinearGradient(0, r * 0.3, 0, r);
    botGrad.addColorStop(0, "rgba(160, 180, 210, 0.8)");
    botGrad.addColorStop(1, "rgba(120, 140, 180, 0.6)");
    ctx.fillStyle = botGrad;
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Shimmer highlight
    const shimmer = 0.5 + 0.5 * Math.sin(time * 2.5);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + shimmer * 0.4})`;
    ctx.beginPath();
    ctx.arc(p.x - r * 0.2, p.y - r * 0.3, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createCrystalDrop(
  t0: number,
  position: { x: number; y: number },
  options?: { size?: number },
): CrystalDrop {
  return new CrystalDrop(t0, position, options);
}
