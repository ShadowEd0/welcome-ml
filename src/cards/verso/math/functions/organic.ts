/**
 * Organic / special functions.
 *
 * These curves have distinctive shapes that serve well as compositional
 * focal points: butterfly wings, infinity symbols, orbital waves.
 */

import type { CurveSpec, MathFunction } from "../types";

/** Butterfly curve (Templeton parametrization). */
export function butterfly(scale = 0.2): CurveSpec {
  const fn: MathFunction = (t) => {
    const et = Math.exp(Math.cos(t));
    const inner = et - 2 * Math.cos(4 * t) * Math.pow(Math.sin(t), 5);
    return {
      x: scale * inner * Math.cos(t),
      y: scale * inner * Math.sin(t),
    };
  };
  return {
    id: "butterfly",
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Butterfly curve (Templeton)",
  };
}

/** Infinity symbol (lemniscate parametrization). */
export function infinity(scale = 1): CurveSpec {
  const fn: MathFunction = (t) => {
    if (Math.cos(2 * t) < 0) return { x: 0, y: 0 };
    const denom = 1 + Math.sin(t) * Math.sin(t);
    const r = (scale * Math.sqrt(2 * Math.cos(2 * t))) / denom;
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: "infinity",
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Infinity symbol",
  };
}