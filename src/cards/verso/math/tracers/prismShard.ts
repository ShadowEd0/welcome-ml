import type { CoordinateSystem } from "../coordinates";
import type { Tracer } from "../types";
import { CurveTracer } from "../tracer";

/**
 * "prism_shard" — a small crystalline diamond shape with prismatic facets.
 *
 * A faceted gem-like form with subtle color separation suggesting light
 * passing through a tiny prism.
 */
export class PrismShardTracer extends CurveTracer {
  render(
    ctx: CanvasRenderingContext2D,
    cs: CoordinateSystem,
    time: number,
  ): void {
    const p = cs.worldToScreen(this.position);
    const r = this.size * cs.scale;
    const shimmer = 0.7 + Math.sin(time * 3.1) * 0.3;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(time * 0.4);

    // Outer diamond
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.6);
    ctx.lineTo(r * 0.9, 0);
    ctx.lineTo(0, r * 1.6);
    ctx.lineTo(-r * 0.9, 0);
    ctx.closePath();

    // Faceted fill with prismatic gradient
    const facet = ctx.createLinearGradient(-r, -r, r, r);
    facet.addColorStop(0, `rgba(200, 180, 255, ${0.85 * shimmer})`);
    facet.addColorStop(0.5, `rgba(180, 220, 255, ${0.9 * shimmer})`);
    facet.addColorStop(1, `rgba(255, 200, 220, ${0.85 * shimmer})`);
    ctx.fillStyle = facet;
    ctx.fill();

    // Inner facet lines
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * shimmer})`;
    ctx.lineWidth = Math.max(0.5, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.6);
    ctx.lineTo(0, r * 1.6);
    ctx.moveTo(-r * 0.9, 0);
    ctx.lineTo(r * 0.9, 0);
    ctx.stroke();

    // Center highlight
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * shimmer})`;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

export function createPrismShard(
  t0: number,
  position: { x: number; y: number },
  options: { size: number },
): Tracer {
  return new PrismShardTracer(t0, position, options);
}