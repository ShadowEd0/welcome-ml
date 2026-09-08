/**
 * "emerald_garden" — an abstract nocturnal garden.
 *
 * Deep emerald darkness with soft green halos, faint organic glows and
 * slow-drifting spores. Alive but never loud — a quiet enchanted night.
 */

import type { Universe } from "../types";
import { makeRng, drawMote, vignette, withAlpha } from "./helpers";

interface Spore {
  x: number;
  y: number;
  r: number;
  drift: number;
  phase: number;
}

export class EmeraldGardenUniverse implements Universe {
  readonly animates = true;
  private readonly spores: Spore[] = [];

  constructor(count = 30) {
    const rng = makeRng(73511);
    for (let i = 0; i < count; i++) {
      this.spores.push({
        x: rng(),
        y: rng(),
        r: 0.6 + rng() * 1.6,
        drift: 0.015 + rng() * 0.03,
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
    // Deep emerald gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#061a14");
    grad.addColorStop(0.5, "#0a2a1e");
    grad.addColorStop(1, "#04120c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Soft green halos (like distant firefly clusters)
    const halos = [
      { x: 0.28, y: 0.65, r: 0.35, color: "#3fae7a", a: 0.1 },
      { x: 0.72, y: 0.35, r: 0.3, color: "#5fc490", a: 0.08 },
    ];
    const maxR = Math.max(width, height);
    for (const h of halos) {
      const cx = h.x * width + Math.sin(time * 0.2 + h.x * 10) * maxR * 0.02;
      const cy = h.y * height + Math.cos(time * 0.18 + h.y * 10) * maxR * 0.02;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, h.r * maxR);
      g.addColorStop(0, withAlpha(h.color, h.a));
      g.addColorStop(1, withAlpha(h.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, h.r * maxR, 0, Math.PI * 2);
      ctx.fill();
    }

    // Drifting spores
    for (const s of this.spores) {
      const y = (s.y - time * s.drift) % 1;
      const yy = y < 0 ? y + 1 : y;
      const sway = Math.sin(time * 0.5 + s.phase) * 0.015;
      const a = 0.3 + 0.3 * Math.sin(time * 0.9 + s.phase);
      drawMote(ctx, (s.x + sway) * width, yy * height, s.r, "#b6f5cf", a);
    }

    vignette(ctx, width, height, 0.5, 0.32);
  }
}
