/**
 * "arctic_silence" — a cold, almost silent space.
 *
 * One of the most minimalist: deep blue-grey, cold grey, icy halos, very fine
 * atmospheric lines, almost invisible particles. The signature is silence +
 * cold + purity.
 */

import type { Universe } from "../types";
import { makeRng, drawMote, vignette, withAlpha } from "./helpers";

export class ArcticSilenceUniverse implements Universe {
  readonly animates = true;
  private readonly motes: { x: number; y: number; r: number; a: number; phase: number }[] = [];

  constructor(count = 14) {
    const rng = makeRng(310103);
    for (let i = 0; i < count; i++) {
      this.motes.push({
        x: rng(),
        y: rng(),
        r: 0.3 + rng() * 0.7,
        a: 0.1 + rng() * 0.2,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ): void {
    // Deep cold blue-grey vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0e1620");
    grad.addColorStop(0.5, "#0a1018");
    grad.addColorStop(1, "#060a10");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Icy halo (cool, upper area)
    const cx = width * 0.5;
    const cy = height * 0.35;
    const r = Math.max(width, height) * 0.55;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    halo.addColorStop(0, withAlpha("#a8c8e0", 0.08));
    halo.addColorStop(0.6, withAlpha("#80a0b8", 0.03));
    halo.addColorStop(1, withAlpha("#80a0b8", 0));
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, width, height);

    // Very fine atmospheric lines (almost static, barely shifting)
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = "#b0c8d8";
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const y = height * (0.3 + i * 0.2) + Math.sin(time * 0.08 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        width * 0.33, y + Math.sin(time * 0.1 + i) * 4,
        width * 0.66, y - Math.sin(time * 0.1 + i) * 4,
        width,
        y
      );
      ctx.stroke();
    }
    ctx.restore();

    // Almost invisible drifting motes
    for (const m of this.motes) {
      const a = m.a * (0.6 + 0.4 * Math.sin(time * 0.3 + m.phase));
      drawMote(ctx, m.x * width, m.y * height, m.r, "#d0e4f0", a);
    }

    vignette(ctx, width, height, 0.4, 0.3);
  }
}
