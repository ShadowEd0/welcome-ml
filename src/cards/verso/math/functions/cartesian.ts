/**
 * Cartesian functions: y = f(x).
 *
 * These functions map t → (t, f(t)) so they compose uniformly with the
 * rest of the engine. Domains are chosen so the curve fits comfortably
 * in the default viewport.
 */

import type { CurveSpec, MathFunction } from "../types";

/** Sine wave: y = A·sin(k·t + phase). */
export function sineWave(
  amplitude = 0.5,
  frequency = 2,
  phase = 0
): CurveSpec {
  const fn: MathFunction = (t) => ({
    x: t,
    y: amplitude * Math.sin(frequency * t + phase),
  });
  return {
    id: `sine_${amplitude}_${frequency}`,
    fn,
    domain: { min: -Math.PI, max: Math.PI },
    closed: false,
    description: `Sine wave A=${amplitude} k=${frequency}`,
  };
}

/** Cosine wave: y = A·cos(k·t + phase). */
export function cosineWave(
  amplitude = 0.5,
  frequency = 2,
  phase = 0
): CurveSpec {
  const fn: MathFunction = (t) => ({
    x: t,
    y: amplitude * Math.cos(frequency * t + phase),
  });
  return {
    id: `cosine_${amplitude}_${frequency}`,
    fn,
    domain: { min: -Math.PI, max: Math.PI },
    closed: false,
    description: `Cosine wave A=${amplitude} k=${frequency}`,
  };
}

/** Damped wave: y = A·e^(-d·|t|)·sin(k·t). */
export function dampedWave(
  amplitude = 0.5,
  frequency = 3,
  decay = 0.8
): CurveSpec {
  const fn: MathFunction = (t) => ({
    x: t,
    y: amplitude * Math.exp(-decay * Math.abs(t)) * Math.sin(frequency * t),
  });
  return {
    id: `damped_${amplitude}_${frequency}_${decay}`,
    fn,
    domain: { min: -Math.PI * 2, max: Math.PI * 2 },
    closed: false,
    description: `Damped wave A=${amplitude} k=${frequency} d=${decay}`,
  };
}

/** Gaussian bell: y = A·e^(-(t-μ)² / 2σ²). */
export function gaussian(
  amplitude = 0.8,
  mean = 0,
  sigma = 0.5
): CurveSpec {
  const fn: MathFunction = (t) => {
    const z = (t - mean) / sigma;
    return { x: t, y: amplitude * Math.exp(-0.5 * z * z) };
  };
  return {
    id: `gaussian_${amplitude}_${mean}_${sigma}`,
    fn,
    domain: { min: -2, max: 2 },
    closed: false,
    description: `Gaussian A=${amplitude} μ=${mean} σ=${sigma}`,
  };
}