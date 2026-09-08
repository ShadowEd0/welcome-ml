/**
 * Math Verso Engine — sampling.
 *
 * Turns a continuous mathematical function into a discrete polyline.
 * Sampling is pure and deterministic: same function + spec → same points.
 * Scenes pre-sample once per resize, never per frame.
 */

import type {
  MathFunction,
  SampledCurve,
  SamplingSpec,
  WorldPoint,
} from "./types";

/** Sample a function over its domain into `count` evenly spaced points. */
export function sample(fn: MathFunction, spec: SamplingSpec): WorldPoint[] {
  const { min, max } = spec.domain;
  const n = Math.max(2, Math.floor(spec.count));
  const points: WorldPoint[] = new Array(n + 1);
  const step = (max - min) / n;
  for (let i = 0; i <= n; i++) {
    points[i] = fn(min + step * i);
  }
  return points;
}

/** Build a sampled curve from a function + spec, auto-detecting closure. */
export function sampleCurve(
  fn: MathFunction,
  spec: SamplingSpec,
  closed: boolean
): SampledCurve {
  return { fn, spec, points: sample(fn, spec), closed };
}

/**
 * Estimate whether a curve is closed by comparing its endpoints.
 * Used as a fallback when the caller does not know.
 */
export function estimateClosed(points: readonly WorldPoint[], eps = 1e-3): boolean {
  if (points.length < 2) return false;
  const a = points[0];
  const b = points[points.length - 1];
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy < eps * eps;
}
