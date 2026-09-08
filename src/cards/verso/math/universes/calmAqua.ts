/**
 * "calm_aqua" — a deep, quiet underwater dark with soft light rays.
 *
 * Dark teal-black water where slow, swaying light rays fall from the top.
 * Kept very dark so luminous curves read clearly; nothing glows harshly.
 */

import type { Universe } from "../types";
import { withAlpha, vignette } from "./helpers";

export class CalmAquaUniverse implements Universe {
  readonly animates = true;

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ): void {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#031318");
    grad.addColorStop(0.55, "#06222a");
    grad.addColorStop(1, "#020d11");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const maxR = Math.max(width, height);

    // Soft moon-source above the water surface.
    const mg = ctx.createRadialGradient(width * 0.5, height * 0.12, 0, width * 0.5, height * 0.12, maxR * 0.3);
    mg.addColorStop(0, withAlpha("#3f7f8f", 0.14));
    mg.addColorStop(1, withAlpha("#3f7f8f", 0));
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, width, height);

    // Swaying light rays (thin translucent triangles).
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rays = 4;
    for (let i = 0; i < rays; i++) {
      const phase = i * 1.6 + time * 0.14;
      const center = width * (0.18 + i * 0.24);
      const sway = Math.sin(phase) * width * 0.1;
      const tipA = center + sway;
      const topA = center - width * 0.09 + Math.sin(phase * 1.3) * width * 0.03;
      const topB = center + width * 0.09 + Math.sin(phase * 1.3 + 1.1) * width * 0.03;
      const gradRay = ctx.createLinearGradient(0, 0, 0, height);
      gradRay.addColorStop(0, withAlpha("#6fc6d8", 0.05));
      gradRay.addColorStop(1, withAlpha("#6fc6d8", 0));
      ctx.fillStyle = gradRay;
      ctx.beginPath();
      ctx.moveTo(tipA, height * 0.9);
      ctx.lineTo(topA, 0);
      ctx.lineTo(topB, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    vignette(ctx, width, height, 0.4, 0.3);
  }
}