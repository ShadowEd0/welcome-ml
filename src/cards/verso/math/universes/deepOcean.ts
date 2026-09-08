/**
 * "deep_ocean" — an abstract underwater space.
 *
 * Dark teal/petroleum vertical gradient with light filtering from above,
 * faint depth strata and slow-drifting motes. Dark enough that luminous
 * curves remain legible.
 */

import type { Universe } from "../types";
import { makeRng, drawMote, vignette, withAlpha } from "./helpers";

interface Mote {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

export class DeepOceanUniverse implements Universe {
  readonly animates = true;
  private readonly motes: Mote[] = [];

  constructor(count = 26) {
    const rng = makeRng(90210);
    for (let i = 0; i < count; i++) {
      this.motes.push({
        x: rng(),
        y: rng(),
        r: 0.5 + rng() * 1.4,
        speed: 0.02 + rng() * 0.05,
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
    // Vertical gradient: lighter petroleum at top → abyssal dark at bottom
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0a2a36");
    grad.addColorStop(0.4, "#072230");
    grad.addColorStop(1, "#03101a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Light shaft from above (caustic-like soft glow)
    const shaft = ctx.createRadialGradient(
      width * 0.5,
      -height * 0.1,
      0,
      width * 0.5,
      -height * 0.1,
      height * 0.9
    );
    shaft.addColorStop(0, withAlpha("#7fd8e8", 0.12));
    shaft.addColorStop(0.5, withAlpha("#5fb8c8", 0.05));
    shaft.addColorStop(1, withAlpha("#5fb8c8", 0));
    ctx.fillStyle = shaft;
    ctx.fillRect(0, 0, width, height);

    // Faint horizontal depth strata
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.strokeStyle = "#9fe6f0";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (height * i) / 5 + Math.sin(time * 0.15 + i) * 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    // Drifting motes rising slowly
    for (const m of this.motes) {
      const y = (m.y - time * m.speed) % 1;
      const yy = y < 0 ? y + 1 : y;
      const sway = Math.sin(time * 0.6 + m.phase) * 0.01;
      const a = 0.25 + 0.25 * Math.sin(time * 0.8 + m.phase);
      drawMote(ctx, (m.x + sway) * width, yy * height, m.r, "#bff0f8", a);
    }

    vignette(ctx, width, height, 0.5, 0.35);
  }
}
