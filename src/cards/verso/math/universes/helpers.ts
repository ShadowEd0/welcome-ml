/**
 * Math Verso Engine — universe helpers.
 *
 * Small, pure drawing utilities shared by the atmospheric backdrops.
 * They know nothing about the engine lifecycle; they only paint into a
 * Canvas2D context using the dimensions they are given.
 */

/**
 * Draw a soft radial glow centered at (cx, cy).
 * The glow fades from `color` at the center to transparent at `radius`.
 */
export function radialGlow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string,
  alpha = 0.5
): void {
  if (radius <= 0) return;
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  g.addColorStop(0, withAlpha(color, alpha));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a subtle vignette that darkens the edges of the viewport.
 */
export function vignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength = 0.4,
  innerRatio = 0.3
): void {
  if (strength <= 0) return;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.max(width, height) * 0.75;
  ctx.save();
  const vg = ctx.createRadialGradient(cx, cy, r * innerRatio, cx, cy, r);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/**
 * Parse a hex color into an [r, g, b] tuple.
 * Supports #rgb and #rrggbb.
 */
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return [r, g, b];
}

/**
 * Return a CSS rgba() string from a hex color and an alpha value.
 */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * A tiny seeded PRNG so a universe can pre-compute a stable set of
 * decorative points (stars, spores, motes) once and reuse them forever.
 *
 * Returns a function `next()` producing floats in [0, 1).
 */
export function makeRng(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
}

/**
 * A small star/mote drawn as a soft dot with optional cross sparkle.
 */
export function drawMote(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number,
  sparkle = false
): void {
  if (alpha <= 0 || radius <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
  g.addColorStop(0, color);
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
  ctx.fill();

  if (sparkle && radius > 1.2) {
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.6;
    const len = radius * 4;
    ctx.beginPath();
    ctx.moveTo(x - len, y);
    ctx.lineTo(x + len, y);
    ctx.moveTo(x, y - len);
    ctx.lineTo(x, y + len);
    ctx.stroke();
  }
  ctx.restore();
}
