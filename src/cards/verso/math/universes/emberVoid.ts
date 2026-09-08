/**
 * "ember_void" — a near-black warmer space with slow drifting embers.
 *
 * Deep maroon-black gradient with a quiet amber nebula near the bottom and
 * a slow snow of faint ember motes rising like sparks. Dark, warm, alive.
 */

import type { Universe } from "../types";
import { drawMote, makeRng, withAlpha, vignette } from "./helpers";

export class EmberVoidUniverse implements Universe {
  readonly animates = true;
  private readonly motes: { x: number; y: number; r: number; a: number; sp: number }[] = [];

  constructor(moteCount = 26) {
    const rng = makeRng(20261);
    for (let i = 0; i < moteCount; i++) {
      this.motes.push({
        x: rng(),
        y: rng(),
        r: 0.0012 + rng() * 0.0018,
        a: 0.08 + rng() * 0.14,
        sp: 0.1 + rng() * 0.25,
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
    grad.addColorStop(0, "#120705");
    grad.addColorStop(0.55, "#1a0c06");
    grad.addColorStop(1, "#0c0503");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Warm ember nebula, lower third.
    const maxR = Math.max(width, height);
    const ex = width * (0.5 + 0.06 * Math.sin(time * 0.15));
    const ey = height * 0.78;
    const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, maxR * 0.55);
    eg.addColorStop(0, withAlpha("#c2410c", 0.14));
    eg.addColorStop(0.5, withAlpha("#8a2f08", 0.06));
    eg.addColorStop(1, withAlpha("#8a2f08", 0));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(ex, ey, maxR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Cold counter-glow top-right, keeps the palette from burning too hot.
    const cg = ctx.createRadialGradient(
      width * 0.8,
      height * 0.16,
      0,
      width * 0.8,
      height * 0.16,
      maxR * 0.4
    );
    cg.addColorStop(0, withAlpha("#3d2b5a", 0.1));
    cg.addColorStop(1, withAlpha("#3d2b5a", 0));
    ctx.fillStyle = cg;
    ctx.fillRect(0, 0, width, height);

    // Rising ember motes.
    for (const m of this.motes) {
      const drift = Math.sin(time * m.sp * 2 + m.x * 9) * width * 0.05;
      const rise = ((m.y - time * 0.012 * m.sp) % 1 + 1) % 1;
      const pulse = 0.6 + 0.4 * Math.sin(time * m.sp * 3 + m.x * 13);
      drawMote(
        ctx,
        m.x * width + drift,
        rise * height,
        m.r * maxR * 2.4,
        "#ffb27a",
        m.a * pulse,
        false
      );
    }

    vignette(ctx, width, height, 0.42, 0.28);
  }
}