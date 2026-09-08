/**
 * Math Verso Engine — renderer.
 *
 * The renderer turns a MathVersoConfig + coordinate system into pixels.
 * It is the only Canvas-aware module in the engine. It owns no lifecycle:
 * the scene calls its methods each frame.
 *
 * Responsibilities:
 *   - clear the canvas;
 *   - paint the universe;
 *   - draw the composition (all curve layers);
 *   - draw the trail;
 *   - draw the tracer.
 *
 * The renderer never allocates per frame: all work reuses the canvas and
 * the pre-sampled curves.
 */

import type {
  MathVersoConfig,
  SampledCurve,
  ScreenPoint,
  Tracer,
  Transform2D,
  WorldPoint,
} from "./types";
import type { CoordinateSystem } from "./coordinates";
import { applyTransform } from "./types";

/** Draw a single sampled curve as a smooth polyline, with optional world transform. */
function drawTransformedCurve(
  ctx: CanvasRenderingContext2D,
  cs: CoordinateSystem,
  curve: SampledCurve,
  transform: Transform2D | undefined,
  color: string,
  lineWidth: number,
  glow: number
): void {
  const pts = curve.points;
  if (pts.length < 2) return;

  ctx.save();

  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow * cs.scale * 0.05;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.85;

  ctx.beginPath();
  const first = cs.worldToScreen(applyTransform(pts[0], transform));
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = cs.worldToScreen(applyTransform(pts[i], transform));
    ctx.lineTo(p.x, p.y);
  }
  if (curve.closed) ctx.closePath();
  ctx.stroke();

  ctx.restore();
}

/**
 * A coordinate system whose world→screen mapping applies a Transform2D first.
 *
 * This composes the layer transform into the world→screen projection so that
 * any consumer that maps world points to the screen (curve layers, tracers,
 * trails) sees the transformed geometry. The visual scale of point-like
 * elements (tracer size, glow radius) is intentionally left at the base
 * `cs.scale`: applying a curve-level scale (e.g. ×2) must NOT inflate a
 * tracer into a giant blob. Only its position is transformed.
 */
function withTransform(
  cs: CoordinateSystem,
  transform: Transform2D | undefined
): CoordinateSystem {
  if (!transform) return cs;
  return {
    ...cs,
    worldToScreen: (p: WorldPoint): ScreenPoint =>
      cs.worldToScreen(applyTransform(p, transform)),
  };
}

/**
 * Draw the tracer, honoring an optional world transform.
 *
 * Both the default glow dot and custom self-rendering tracers (M21.1, which
 * draw via `tracer.render(ctx, cs, time)` using `cs.worldToScreen`) go through
 * a coordinate system that applies the layer transform. This keeps
 * scale / mirrorX / mirrorY / rotation / translation consistent between the
 * curve and its tracer without modifying any individual tracer.
 */
function drawTransformedTracer(
  ctx: CanvasRenderingContext2D,
  cs: CoordinateSystem,
  tracer: Tracer,
  transform: Transform2D | undefined,
  color: string,
  time: number
): void {
  const tcs = withTransform(cs, transform);
  if (tracer.render) {
    tracer.render(ctx, tcs, time);
  } else {
    drawTracer(ctx, tcs, tracer, color);
  }
}

/** Draw the tracer as a soft glowing dot. */
function drawTracer(
  ctx: CanvasRenderingContext2D,
  cs: CoordinateSystem,
  tracer: Tracer,
  color: string
): void {
  const p: ScreenPoint = cs.worldToScreen(tracer.position);
  const r = tracer.size * cs.scale;

  ctx.save();

  // Outer glow
  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
  glow.addColorStop(0, color);
  glow.addColorStop(1, "transparent");
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Render one full frame.
 *
 * Tracer/trail rules (global vs. per-layer):
 *
 *  - Per-layer: if a `CurveLayer.tracer` / `CurveLayer.trail` is set, it is
 *    rendered once inside the layer loop, transformed consistently with the
 *    layer's curve.
 *  - Global legacy (`MathVersoConfig.tracer` / `MathVersoConfig.trail`):
 *    rendered once, after the layer loop, with no transformation. Kept for
 *    backward compatibility with scenes like `roseGarden`.
 *
 * Because the global objects are rendered exactly once and each layer's
 * objects are distinct instances, a single trail can never be recorded or
 * drawn twice by accident. A scene may freely mix per-layer tracers/trails
 * with a legacy global tracer/trail; they remain independent.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  cs: CoordinateSystem,
  config: MathVersoConfig
): void {
  ctx.clearRect(0, 0, width, height);

  // Universe (background)
  config.universe.paint(ctx, width, height, time);

  // Composition layers — each layer may have its own transform/tracer/trail
  for (const layer of config.composition.layers) {
    drawTransformedCurve(
      ctx,
      cs,
      layer.curve,
      layer.transform,
      layer.color,
      layer.lineWidth ?? 1.5,
      layer.glow ?? 0
    );

    // Per-layer trail (rendered through the layer transform so it aligns
    // with the transformed curve). Rendered exactly once per layer.
    if (layer.trail) {
      layer.trail.render(ctx, withTransform(cs, layer.transform), time);
    }

    // Per-layer tracer (position transformed consistently with the curve)
    if (layer.tracer) {
      drawTransformedTracer(ctx, cs, layer.tracer, layer.transform, layer.color, time);
    }
  }

  // Global legacy trail (MathVersoConfig.trail) — rendered exactly once,
  // outside the layer loop, so it is never drawn multiple times even when
  // several layers lack their own trail.
  if (config.trail) {
    config.trail.render(ctx, cs, time);
  }
  // Global tracer (backward-compatible: roseGarden uses MathVersoConfig.tracer)
  if (config.tracer) {
    if (config.tracer.render) {
      config.tracer.render(ctx, cs, time);
    } else {
      drawTracer(ctx, cs, config.tracer, config.tracerColor ?? "#ffffff");
    }
  }
}

export type { CoordinateSystem };
