/**
 * "cosmic_plum" — a dense, mysterious cosmic space.
 *
 * Deeper and more mysterious than violet_dream: deep plum, cold bordeaux,
 * dark lavender, with soft halos, tiny nebulae and extremely faint luminous
 * dust. The signature is cosmic density + elegant mystery.
 */

import type { Universe } from "../types";
import { makeRng, drawMote, vignette, withAlpha } from "./helpers";

interface Nebula {
  x: number;
  y: number;
  r: number;
  color: string;
  phase: number;
}

export class CosmicPlumUniverse implements Universe {
  readonly animates = true;
  private readonly nebula: Nebula[] = [];
  private readonly dust: { x: number; y: number; r: number; a: number; phase: number }[] = [];

  constructor() {
    const rng = makeRng(140814);
    const nebColors = ["#6a3a8a", "#5a2a6e", "#8a4a7a", "#4a2a5a"];
    for (let i = 0; i < 5; i++) {
      this.nebula.push({
        x: rng(),
        y: rng(),
        r: 0.2 + rng() * 0.35,
        color: nebColors[i % nebColors.length],
        phase: rng() * Math.PI * 2,
      });
    }
    for (let i = 0; i < 40; i++) {
      this.dust.push({
        x: rng(),
        y: rng(),
        r: 0.3 + rng() * 0.9,
        a: 0.15 + rng() * 0.3,
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
    // Deep plum vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#1a0e26");
    grad.addColorStop(0.5, "#140a1e");
    grad.addColorStop(1, "#0a0612");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Soft nebular halos (slowly pulsing)
    for (const n of this.nebula) {
      const pulse = 0.85 + 0.15 * Math.sin(time * 0.2 + n.phase);
      const cx = n.x * width;
      const cy = n.y * height;
      const r = n.r * Math.max(width, height) * pulse;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, withAlpha(n.color, 0.18));
      g.addColorStop(0.6, withAlpha(n.color, 0.06));
      g.addColorStop(1, withAlpha(n.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Faint luminous dust
    for (const d of this.dust) {
      const a = d.a * (0.6 + 0.4 * Math.sin(time * 0.5 + d.phase));
      drawMote(ctx, d.x * width, d.y * height, d.r, "#d8c8ff", a);
    }

    vignette(ctx, width, height, 0.5, 0.3);
  }
}
