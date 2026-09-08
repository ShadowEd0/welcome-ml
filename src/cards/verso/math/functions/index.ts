/**
 * Math Verse Engine — functions barrel + registry.
 *
 * Re-exports all curve families and provides a registry for lookup by id.
 */

export type { CurveSpec, MathFunction, TDomain } from "../types";

// Existing core functions (migrated from functions.ts)
export { lissajous, rose, cardioid, lemniscate, spiral, circle } from "./core";

// New families
export {
  sineWave,
  cosineWave,
  dampedWave,
  gaussian,
} from "./cartesian";

export {
  clover,
  petal,
  limacon,
  waveOrbit,
} from "./polar";

export {
  ellipse,
  heart,
  hypotrochoid,
  epitrochoid,
} from "./parametric";

export {
  butterfly,
  infinity,
} from "./organic";

// Registry helpers
import { lissajous, rose, cardioid, lemniscate, spiral, circle } from "./core";
import { sineWave, cosineWave, dampedWave, gaussian } from "./cartesian";
import { clover, petal, limacon, waveOrbit } from "./polar";
import { ellipse, heart, hypotrochoid, epitrochoid } from "./parametric";
import { butterfly, infinity } from "./organic";

import type { CurveSpec } from "../types";

export interface MathFunctionFactory {
  (...args: any[]): CurveSpec;
}

export const MATH_FUNCTIONS: Record<string, MathFunctionFactory> = {
  sine_wave: sineWave,
  cosine_wave: cosineWave,
  damped_wave: dampedWave,
  gaussian,
  rose,
  cardioid,
  limacon,
  lemniscate,
  spiral,
  clover,
  petal,
  circle,
  ellipse,
  heart,
  lissajous,
  hypotrochoid,
  epitrochoid,
  butterfly,
  infinity,
  wave_orbit: waveOrbit,
};

export function listMathFunctionIds(): string[] {
  return Object.keys(MATH_FUNCTIONS);
}

export function createMathFunction(id: string, ...args: unknown[]): CurveSpec | undefined {
  const factory = MATH_FUNCTIONS[id];
  if (!factory) return undefined;
  return factory(...args);
}