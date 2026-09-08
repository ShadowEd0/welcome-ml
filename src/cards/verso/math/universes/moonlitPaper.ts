/**
 * "moonlit_paper" — a precious paper world lit by the moon.
 *
 * Warm ivory/beige with a faint paper grain, a lunar halo and soft layered
 * shadows. A light background by design, but never a flat white: it has
 * texture, depth and a quiet moon glow.
 */

import type { Universe } from "../types";
import { makeRng, withAlpha } from "./helpers";

export class MoonlitPaperUniverse implements Universe {
  readonly animates = false; // static atmosphere; the moon glow is fixed
  private readonly grain: { x: number; y: number; a: number }[] = [];

  constructor(grainCount = 80) {
    const rng = makeRng(101010);
    for (let i = 0; i < grainCount; i++) {
      this.grain.push({
        x: rng(),
        y: rng(),
        a: 0.015 + rng() * 0.03,
      });
    }
  }

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    // Warm ivory vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#f3ece0");
    grad.addColorStop(0.6, "#ebe2d2");
    grad.addColorStop(1, "#ddd2be");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Lunar halo (cool, soft, upper area)
    const cx = width * 0.72;
    const cy = height * 0.22;
    const r = Math.max(width, height) * 0.5;
    const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    hg.addColorStop(0, withAlpha("#dfe6f2", 0.22));
    hg.addColorStop(0.4, withAlpha("#e6e8ee", 0.08));
    hg.addColorStop(1, withAlpha("#e6e8ee", 0));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Faint warm depth shadow near the bottom
    const sg = ctx.createLinearGradient(0, height * 0.7, 0, height);
    sg.addColorStop(0, withAlpha("#c9b89c", 0));
    sg.addColorStop(1, withAlpha("#b8a588", 0.18));
    ctx.fillStyle = sg;
    ctx.fillRect(0, height * 0.7, width, height * 0.3);

    // Paper grain (tiny soft dots)
    for (const g of this.grain) {
      ctx.save();
      ctx.globalAlpha = g.a;
      ctx.fillStyle = "#a89878";
      ctx.fillRect(g.x * width, g.y * height, 1, 1);
      ctx.restore();
    }
  }
}
