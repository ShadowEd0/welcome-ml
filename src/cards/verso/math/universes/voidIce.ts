/**
 * "void_ice" — a deep frozen void, almost black with sparse ice dust.
 *
 * Very dark blue-black base, a faint cold auroral shimmer that moves very
 * slowly, and a sparse fixed field of tiny ice crystals. Perfect backdrop
 * for crystalline / arctic curves without ever reading as "white".
 */

import type { Universe } from "../types";
import { drawMote, makeRng, withAlpha, vignette } from "./helpers";

export class VoidIceUniverse implements Universe {
  readonly animates = true;
  private readonly dust: { x: number; y: number; r: number; a: number }[] = [];

  constructor(dustCount = 40) {
    const rng = makeRng(31127);
    for (let i = 0; i < dustCount; i++) {
      this.dust.push({
        x: rng(),
        y: rng(),
        r: 0.0009 + rng() * 0.0012,
        a: 0.07 + rng() * 0.12,
      });
    }
  }

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#050a13");
    grad.addColorStop(0.5, "#0a1322");
    grad.addColorStop(1, "#04070e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const maxR = Math.max(width, height);

    // Slow auroral shimmer, upper area.
    for (let band = 0; band < 2; band++) {
      const t0 = time * 0.05 + band * Math.PI;
      const bx = width * (0.5 + 0.24 * Math.sin(t0));
      const by = height * (0.22 + 0.1 * Math.cos(t0 * 0.7));
      const bg = ctx.createRadialGradient(bx, by, 0, bx, by, maxR * 0.34);
      bg.addColorStop(0, withAlpha(band === 0 ? "#2b5f9e" : "#1f4c7a", 0.11));
      bg.addColorStop(1, withAlpha(band === 0 ? "#2b5f9e" : "#1f4c7a", 0));
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, maxR * 0.34, 0, Math.PI * 2);
      ctx.fill();
    }

    // Frozen dust, gently twinkling.
    for (const d of this.dust) {
      const tw = 0.6 + 0.4 * Math.sin(time * 0.6 + d.x * 23 + d.y * 17);
      drawMote(ctx, d.x * width, d.y * height, d.r * maxR * 2.2, "#bfe0ff", d.a * tw, false);
    }

    vignette(ctx, width, height, 0.46, 0.26);
  }
}