/**
 * Math Verso Engine — coordinate system.
 *
 * The coordinate system is the single visual grammar shared by every
 * mathematical verso. It maps world coordinates (the mathematical space
 * where curves live) to screen coordinates (pixels on the canvas) and
 * back.
 *
 * Design goals:
 *   - the origin sits at the centre of the viewport;
 *   - the y-axis points UP (mathematical convention), not down;
 *   - the scale is uniform in both directions (no distortion);
 *   - the system adapts to any aspect ratio without stretching curves.
 *
 * The frame is intentionally NOT a school grid: it is a minimal, luminous
 * reference that can be shown or hidden by the scene.
 */

import type { ScreenPoint, WorldPoint } from "./types";

export interface CoordinateSystem {
  /** Current viewport width in CSS pixels. */
  readonly width: number;
  /** Current viewport height in CSS pixels. */
  readonly height: number;
  /**
   * Half the size of the shorter side, in CSS pixels. This is the
   * reference radius: a world unit maps to `scale` pixels on the short
   * axis, guaranteeing curves never overflow the viewport regardless of
   * aspect ratio.
   */
  readonly scale: number;
  /** Centre of the viewport in screen coordinates. */
  readonly center: ScreenPoint;
  /** Map a world point to a screen point. */
  readonly worldToScreen: (p: WorldPoint) => ScreenPoint;
  /** Map a screen point to a world point. */
  readonly screenToWorld: (p: ScreenPoint) => WorldPoint;
}

/**
 * Build a coordinate system for the given viewport.
 *
 * @param width  viewport width in CSS pixels
 * @param height viewport height in CSS pixels
 * @param margin fraction of the short side kept as padding (0..1)
 */
export function createCoordinateSystem(
  width: number,
  height: number,
  margin = 0.08
): CoordinateSystem {
  const shortSide = Math.min(width, height);
  const padded = shortSide * (1 - margin);
  const scale = padded / 2;
  const center: ScreenPoint = { x: width / 2, y: height / 2 };

  return {
    width,
    height,
    scale,
    center,
    worldToScreen: (p: WorldPoint): ScreenPoint => ({
      x: center.x + p.x * scale,
      // y is inverted: world +y is up, screen +y is down.
      y: center.y - p.y * scale,
    }),
    screenToWorld: (p: ScreenPoint): WorldPoint => ({
      x: (p.x - center.x) / scale,
      y: (center.y - p.y) / scale,
    }),
  };
}

/**
 * Draw a minimal, elegant reference frame.
 *
 * The frame is intentionally subtle: a thin crosshair with soft glow,
 * never a heavy grid. Scenes may omit it entirely.
 */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  cs: CoordinateSystem,
  color: string,
  alpha = 0.18
): void {
  const { width, height, center } = cs;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  // Horizontal axis
  ctx.beginPath();
  ctx.moveTo(0, center.y);
  ctx.lineTo(width, center.y);
  ctx.stroke();

  // Vertical axis
  ctx.beginPath();
  ctx.moveTo(center.x, 0);
  ctx.lineTo(center.x, height);
  ctx.stroke();

  // Soft centre glow
  const glow = ctx.createRadialGradient(
    center.x,
    center.y,
    0,
    center.x,
    center.y,
    cs.scale * 0.15
  );
  glow.addColorStop(0, color);
  glow.addColorStop(1, "transparent");
  ctx.globalAlpha = alpha * 0.6;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(center.x, center.y, cs.scale * 0.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
