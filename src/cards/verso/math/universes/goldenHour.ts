/**
 * "golden_hour" — a warm, almost crepuscular light.
 *
 * Not a uniform orange: deep browns, amber, gold, a lateral light, luminous
 * dust and an abstract solar halo. The signature is warmth + nostalgia + light.
 */

import type { Universe } from "../types";
import { makeRng, drawMote, vignette, withAlpha } from "./helpers";

export class GoldenHourUniverse implements Universe {
  readonly animates = true;
  private readonly dust: { x: number; y: number; r: number; a: number; phase: number; speed: number }[] = [];

  constructor(count = 30) {
    const rng = makeRng(190720);
    for (let i = 0; i < count; i++) {
      this.dust.push({
        x: rng(),
        y: rng(),
        r: 0.5 + rng() * 1.3,
        a: 0.2 + rng() * 0.4,
        phase: rng() * Math.PI * 2,
        speed: 0.03 + rng() * 0.06,
      });
    }
  }

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ): void {
    // Deep warm vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#2a1a10");
    grad.addColorStop(0.5, "#1e1208");
    grad.addColorStop(1, "#100a04");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Abstract solar halo (warm, lateral)
    const sx = width * 0.78;
    const sy = height * 0.3;
    const sr = Math.max(width, height) * 0.6;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    sun.addColorStop(0, withAlpha("#ffb060", 0.22));
    sun.addColorStop(0.4, withAlpha("#d88030", 0.08));
    sun.addColorStop(1, withAlpha("#d88030", 0));
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);

    // Warm horizontal light band
    const band = ctx.createLinearGradient(0, height * 0.45, 0, height * 0.7);
    band.addColorStop(0, withAlpha("#c88838", 0));
    band.addColorStop(0.5, withAlpha("#a07030", 0.06));
    band.addColorStop(1, withAlpha("#a07030", 0));
    ctx.fillStyle = band;
    ctx.fillRect(0, height * 0.45, width, height * 0.25);

    // Luminous dust drifting slowly
    for (const d of this.dust) {
      const x = (d.x + Math.sin(time * 0.3 + d.phase) * 0.02) % 1;
      const y = (d.y - time * d.speed) % 1;
      const yy = y < 0 ? y + 1 : y;
      const a = d.a * (0.5 + 0.5 * Math.sin(time * 0.7 + d.phase));
      drawMote(ctx, x * width, yy * height, d.r, "#ffd89a", a);
    }

    vignette(ctx, width, height, 0.45, 0.3);
  }
}
