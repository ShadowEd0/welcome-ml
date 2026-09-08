/**
 * Core mathematical functions (migrated from the original functions.ts).
 *
 * Every function is a pure mapping t → (x, y). No state, no side effects,
 * no knowledge of Canvas or the DOM.
 */

import type { CurveSpec, MathFunction } from "../types";

/** Lissajous curve: x = sin(a·t + δ), y = sin(b·t). */
export function lissajous(a: number, b: number, delta = Math.PI / 2): CurveSpec {
  const fn: MathFunction = (t) => ({
    x: Math.sin(a * t + delta),
    y: Math.sin(b * t),
  });
  const period = (Math.PI * 2) / gcd(a, b);
  return {
    id: `lissajous_${a}_${b}`,
    fn,
    domain: { min: 0, max: period },
    closed: true,
    description: `Lissajous (${a}, ${b})`,
  };
}

/** Rose curve (rhodonea): r = cos(k·t). */
export function rose(k: number): CurveSpec {
  const fn: MathFunction = (t) => {
    const r = Math.cos(k * t);
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  const period = k % 2 === 0 ? Math.PI : Math.PI * 2;
  return {
    id: `rose_${k}`,
    fn,
    domain: { min: 0, max: period },
    closed: true,
    description: `Rose k=${k}`,
  };
}

/** Cardioid: r = 1 − cos(t). */
export function cardioid(): CurveSpec {
  const fn: MathFunction = (t) => {
    const r = 1 - Math.cos(t);
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: "cardioid",
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Cardioid",
  };
}

/** Lemniscate of Bernoulli: figure-eight. */
export function lemniscate(scale = 1): CurveSpec {
  const fn: MathFunction = (t) => {
    const cos2 = Math.cos(t) * Math.cos(t);
    const r = (scale * Math.sqrt(2 * cos2)) / (1 + Math.sin(t) * Math.sin(t));
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: "lemniscate",
    fn,
    domain: { min: -Math.PI / 2 + 0.2, max: Math.PI / 2 - 0.2 },
    closed: true,
    description: "Lemniscate",
  };
}

/** Archimedean spiral: r = a + b·t. */
export function spiral(a: number, b: number, turns: number): CurveSpec {
  const fn: MathFunction = (t) => {
    const r = a + b * t;
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: `spiral_${turns}`,
    fn,
    domain: { min: 0, max: Math.PI * 2 * turns },
    closed: false,
    description: `Spiral (${turns} turns)`,
  };
}

/** Circle of given radius. */
export function circle(radius = 1): CurveSpec {
  const fn: MathFunction = (t) => ({
    x: radius * Math.cos(t),
    y: radius * Math.sin(t),
  });
  return {
    id: `circle_${radius}`,
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: `Circle r=${radius}`,
  };
}

/** GCD helper for Lissajous periods. */
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}