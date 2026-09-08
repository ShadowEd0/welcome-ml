/**
 * "rose_cosmos" — a cosmic universe tinted with mature rose.
 *
 * Not candy pink: bordeaux, mauve, dusty rose, with soft halos, very discreet
 * stars and a light cosmic mist. The signature is elegance + emotion + cosmos.
 */

import type { Universe } from "../types";
import { makeRng, drawMote, vignette, withAlpha } from "./helpers";

export class RoseCosmosUniverse implements Universe {
  readonly animates = true;
  private readonly stars: { x: number; y: number; r: number; a: number; phase: number }[] = [];

  constructor(count = 45) {
    const rng = makeRng(260210);
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: rng(),
        y: rng(),
        r: 0.3 + rng() * 1.0,
        a: 0.2 + rng() * 0.4,
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
    // Deep bordeaux-mauve vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#1a0e1a");
    grad.addColorStop(0.5, "#140a16");
    grad.addColorStop(1, "#0a060e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Soft rose halos (two layered glows)
    const drawHalo = (hx: number, hy: number, hr: number, color: string, alpha: number) => {
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      g.addColorStop(0, withAlpha(color, alpha));
      g.addColorStop(0.5, withAlpha(color, alpha * 0.4));
      g.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, 0, Math.PI * 2);
      ctx.fill();
    };
    drawHalo(width * 0.35, height * 0.4, Math.max(width, height) * 0.5, "#a04868", 0.1);
    drawHalo(width * 0.7, height * 0.6, Math.max(width, height) * 0.45, "#7a3858", 0.08);

    // Light cosmic mist (very subtle warm band)
    const mist = ctx.createLinearGradient(0, height * 0.5, 0, height * 0.8);
    mist.addColorStop(0, withAlpha("#b06878", 0));
    mist.addColorStop(0.5, withAlpha("#905868", 0.04));
    mist.addColorStop(1, withAlpha("#905868", 0));
    ctx.fillStyle = mist;
    ctx.fillRect(0, height * 0.5, width, height * 0.3);

    // Discreet stars with gentle twinkle
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(time * s.a + s.phase);
      const a = s.a * (0.5 + 0.5 * tw);
      drawMote(ctx, s.x * width, s.y * height, s.r, "#f0d0d8", a, s.r > 0.85);
    }

    vignette(ctx, width, height, 0.5, 0.3);
  }
}
