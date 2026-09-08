/**
 * "midnight_observatory" — a deep, calm, almost astronomical night.
 *
 * Not a flat blue: a rich indigo gradient with a soft luminous halo,
 * a scattering of tiny stars and a faint cosmic dust band. The whole
 * scene breathes almost imperceptibly, like a quiet observatory.
 */

import type { Universe } from "../types";
import { makeRng, drawMote, vignette, withAlpha } from "./helpers";

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinklePhase: number;
}

export class MidnightObservatoryUniverse implements Universe {
  readonly animates = true;
  private readonly stars: Star[] = [];
  private readonly haloColor = "#4a5a9a";

  constructor(count = 60) {
    const rng = makeRng(20240601);
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: rng(),
        y: rng(),
        r: 0.4 + rng() * 1.1,
        baseAlpha: 0.25 + rng() * 0.6,
        twinklePhase: rng() * Math.PI * 2,
      });
    }
  }

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ): void {
    // Deep vertical gradient: indigo night → darker blue
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0a0e22");
    grad.addColorStop(0.55, "#0d1330");
    grad.addColorStop(1, "#080a1c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Soft central halo (moonlight / sky glow)
    const cx = width * 0.5;
    const cy = height * 0.42;
    const haloR = Math.max(width, height) * 0.55;
    const pulse = 0.18 + Math.sin(time * 0.25) * 0.04;
    const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
    hg.addColorStop(0, withAlpha(this.haloColor, pulse));
    hg.addColorStop(1, withAlpha(this.haloColor, 0));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
    ctx.fill();

    // Faint horizontal dust band
    const bandY = height * 0.5;
    const bandH = height * 0.18;
    const bg = ctx.createLinearGradient(0, bandY - bandH / 2, 0, bandY + bandH / 2);
    bg.addColorStop(0, "rgba(120,140,200,0)");
    bg.addColorStop(0.5, "rgba(120,140,200,0.05)");
    bg.addColorStop(1, "rgba(120,140,200,0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, bandY - bandH / 2, width, bandH);

    // Stars with gentle twinkle
    for (const s of this.stars) {
      const tw = 0.6 + 0.4 * Math.sin(time * 1.2 + s.twinklePhase);
      const a = s.baseAlpha * tw;
      drawMote(ctx, s.x * width, s.y * height, s.r, "#dfe6ff", a, s.r > 1.1);
    }

    // Vignette for depth
    vignette(ctx, width, height, 0.45, 0.32);
  }
}
