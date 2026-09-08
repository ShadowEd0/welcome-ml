/**
 * "violet_dream" — a deep, soft, dreamlike violet space.
 *
 * Layers of diffuse halos and a gentle vertical gradient create a
 * plush, mysterious atmosphere. No hard edges, no neon — just a calm
 * violet reverie with slow drifting glows.
 */

import type { Universe } from "../types";
import { withAlpha, vignette } from "./helpers";

export class VioletDreamUniverse implements Universe {
  readonly animates = true;

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ): void {
    // Base vertical gradient: deep plum → dark violet
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#1a0f2e");
    grad.addColorStop(0.5, "#241442");
    grad.addColorStop(1, "#120a22");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Three soft, drifting halos at different depths
    const halos = [
      { x: 0.32, y: 0.38, r: 0.5, color: "#7b4fd6", a: 0.16, sp: 0.2 },
      { x: 0.68, y: 0.62, r: 0.45, color: "#9b6fe6", a: 0.13, sp: -0.15 },
      { x: 0.5, y: 0.8, r: 0.6, color: "#5e3fae", a: 0.1, sp: 0.1 },
    ];
    const maxR = Math.max(width, height);
    for (const h of halos) {
      const drift = Math.sin(time * h.sp) * maxR * 0.04;
      const cx = h.x * width + drift;
      const cy = h.y * height + Math.cos(time * h.sp * 0.8) * maxR * 0.03;
      const radius = h.r * maxR;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      g.addColorStop(0, withAlpha(h.color, h.a));
      g.addColorStop(1, withAlpha(h.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle warm counter-glow near the bottom
    const wg = ctx.createRadialGradient(
      width * 0.5,
      height * 1.05,
      0,
      width * 0.5,
      height * 1.05,
      maxR * 0.6
    );
    wg.addColorStop(0, withAlpha("#caa6ff", 0.06));
    wg.addColorStop(1, withAlpha("#caa6ff", 0));
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, width, height);

    vignette(ctx, width, height, 0.42, 0.3);
  }
}
