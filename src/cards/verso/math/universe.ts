/**
 * Math Verso Engine — universe / background abstraction.
 *
 * An universe is the atmospheric backdrop of a mathematical verso. It is
 * independent of the composition: it paints first, the composition paints
 * on top. This module provides one default implementation; future
 * universes (deep ocean, cosmic plum, arctic silence, …) implement the
 * same contract.
 */

import type { Universe } from "./types";

export interface UniverseOptions {
  /** Top color of the gradient. */
  top?: string;
  /** Bottom color of the gradient. */
  bottom?: string;
  /** Optional subtle vignette strength (0..1). */
  vignette?: number;
}

/**
 * A calm vertical-gradient universe with a soft vignette.
 *
 * The gradient is static (no animation), so `animates` is false. The
 * engine therefore paints it once per resize and skips it on subsequent
 * frames when reduced motion is on.
 */
export class GradientUniverse implements Universe {
  private readonly top: string;
  private readonly bottom: string;
  private readonly vignette: number;
  readonly animates = false;

  constructor(options: UniverseOptions = {}) {
    this.top = options.top ?? "#0a0a1a";
    this.bottom = options.bottom ?? "#1a1024";
    this.vignette = options.vignette ?? 0.35;
  }

  paint(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    ctx.save();

    // Vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, this.top);
    grad.addColorStop(1, this.bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Soft vignette
    if (this.vignette > 0) {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.max(width, height) * 0.75;
      const vg = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
      vg.addColorStop(0, "transparent");
      vg.addColorStop(1, `rgba(0,0,0,${this.vignette})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.restore();
  }
}

/**
 * A universe that renders nothing — useful for transparent backgrounds.
 */
export class TransparentUniverse implements Universe {
  readonly animates = false;
  paint(): void {}
}
