/**
 * "black_mirror" — an almost black space with a reflective depth.
 *
 * Not a flat black: graphite, very dark grey, subtle reflections, silver
 * halos, radial gradients and depth through reflected light. The signature
 * is minimalism + luxury + depth.
 */

import type { Universe } from "../types";
import { vignette, withAlpha } from "./helpers";

export class BlackMirrorUniverse implements Universe {
  readonly animates = false; // static atmosphere; depth is fixed

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    // Near-black graphite vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, "#0a0a0c");
    grad.addColorStop(0.5, "#08080a");
    grad.addColorStop(1, "#040406");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Soft radial reflection (center glow, like light on a dark surface)
    const cx = width * 0.5;
    const cy = height * 0.45;
    const r = Math.max(width, height) * 0.6;
    const refl = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    refl.addColorStop(0, withAlpha("#2a2a30", 0.25));
    refl.addColorStop(0.4, withAlpha("#1a1a1e", 0.1));
    refl.addColorStop(1, withAlpha("#1a1a1e", 0));
    ctx.fillStyle = refl;
    ctx.fillRect(0, 0, width, height);

    // Subtle silver halo (cool, upper area)
    const sx = width * 0.5;
    const sy = height * 0.25;
    const sr = Math.max(width, height) * 0.4;
    const silver = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    silver.addColorStop(0, withAlpha("#808090", 0.08));
    silver.addColorStop(0.6, withAlpha("#606070", 0.03));
    silver.addColorStop(1, withAlpha("#606070", 0));
    ctx.fillStyle = silver;
    ctx.fillRect(0, 0, width, height);

    vignette(ctx, width, height, 0.55, 0.3);
  }
}
