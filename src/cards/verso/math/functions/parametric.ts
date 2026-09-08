/**
 * Parametric functions: x = f(t), y = g(t).
 */

import type { CurveSpec, MathFunction } from "../types";

/** Unit circle. */
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

/** Ellipse: x = a·cos t, y = b·sin t. */
export function ellipse(a = 1, b = 0.6): CurveSpec {
  const fn: MathFunction = (t) => ({
    x: a * Math.cos(t),
    y: b * Math.sin(t),
  });
  return {
    id: `ellipse_${a}_${b}`,
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: `Ellipse a=${a} b=${b}`,
  };
}

/** Heart curve (parametric). */
export function heart(scale = 1): CurveSpec {
  const fn: MathFunction = (t) => {
    const norm = scale;
    const hx = norm * 16 * Math.pow(Math.sin(t), 3);
    const hy =
      norm *
      (13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t));
    return {
      x: hx / 100,
      y: hy / 100,
    };
  };
  return {
    id: "heart",
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Heart curve",
  };
}

/** Lissajous: x = A·sin(a·t + δ), y = B·sin(b·t). */
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

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}

/** Hypotrochoid (spirograph inner). x = (R-r)cos(t) + d·cos((R-r)t/r) */
export function hypotrochoid(R = 5, r = 3, d = 2): CurveSpec {
  const fn: MathFunction = (t) => {
    const x = (R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t);
    const y = (R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t);
    return { x: x / 8, y: y / 8 };
  };
  const period = (Math.PI * 2 * r) / gcd(R, r);
  return {
    id: `hypotrochoid_${R}_${r}_${d}`,
    fn,
    domain: { min: 0, max: period },
    closed: true,
    description: `Hypotrochoid R=${R} r=${r} d=${d}`,
  };
}

/** Epitrochoid (spirograph outer). x = (R+r)cos(t) - d·cos((R+r)t/r) */
export function epitrochoid(R = 5, r = 3, d = 2): CurveSpec {
  const fn: MathFunction = (t) => {
    const x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
    const y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
    return { x: x / 10, y: y / 10 };
  };
  const period = (Math.PI * 2 * r) / gcd(R, r);
  return {
    id: `epitrochoid_${R}_${r}_${d}`,
    fn,
    domain: { min: 0, max: period },
    closed: true,
    description: `Epitrochoid R=${R} r=${r} d=${d}`,
  };
}