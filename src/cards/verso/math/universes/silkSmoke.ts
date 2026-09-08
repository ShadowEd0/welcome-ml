/**
 * "silk_smoke" — an almost-black smoky space of drifting grey-plum wisps.
 *
 * No neon, no hard edge: wide translucent smoke sheets that sway slowly
 * (each sheet re-drawn every frame from a time-varying path) over a very
 * dark base. Built for fine luminous filaments to glow against.
 */

import type { Universe } from "../types";
import { withAlpha, vignette } from "./helpers";

export class SilkSmokeUniverse implements Universe {
  readonly animates = true;

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0c0a12");
    grad.addColorStop(0.5, "#140f1c");
    grad.addColorStop(1, "#08060d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const maxR = Math.max(width, height);

    // A faint plum/rose under-glow at the centre — the silk takes its hue
    // from the drawn curves, so the backdrop stays neutral.
    const hg = ctx.createRadialGradient(width * 0.5, height * 0.55, 0, width * 0.5, height * 0.55, maxR * 0.5);
    hg.addColorStop(0, withAlpha("#7a4f8f", 0.09));
    hg.addColorStop(1, withAlpha("#7a4f8f", 0));
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, width, height);

    // Smoke sheets: translucent blobs drifting on slow sine paths.
    const sheets = [
      { x: 0.3, y: 0.32, s: 0.42, sp: 0.07, col: "#caa6ff" },
      { x: 0.68, y: 0.6, s: 0.5, sp: -0.05, col: "#7fb8d8" },
      { x: 0.5, y: 1.02, s: 0.6, sp: 0.04, col: "#8f7bbf" },
    ];
    for (const sh of sheets) {
      const cx = sh.x * width + Math.sin(time * sh.sp * 2 + sh.x * 7) * width * 0.05;
      const cy = sh.y * height + Math.cos(time * sh.sp * 1.4) * height * 0.04;
      const r = sh.s * maxR;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, withAlpha(sh.col, 0.085));
      g.addColorStop(1, withAlpha(sh.col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    vignette(ctx, width, height, 0.44, 0.3);
  }
}