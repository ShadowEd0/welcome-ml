/**
 * Polar functions: r = f(θ).
 *
 * All polar functions return (r·cos θ, r·sin θ) so they share a uniform
 * signature with parametric curves.
 */

import type { CurveSpec, MathFunction } from "../types";

/** Rose curve (rhodonea): r = a·cos(k·θ). */
export function rose(k: number, amplitude = 1): CurveSpec {
  const fn: MathFunction = (t) => {
    const r = amplitude * Math.cos(k * t);
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

/** Cardioid: r = a(1 + cos θ). */
export function cardioid(a = 1, rotation = 0): CurveSpec {
  const fn: MathFunction = (t) => {
    const r = a * (1 + Math.cos(t - rotation));
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: "cardioid",
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: `Cardioid a=${a}`,
  };
}

/** Limaçon: r = a + b·cos θ. */
export function limacon(a = 1, b = 0.5, rotation = 0): CurveSpec {
  const fn: MathFunction = (t) => {
    const r = Math.max(0, a + b * Math.cos(t - rotation));
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: `limacon_${a}_${b}`,
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: `Limaçon a=${a} b=${b}`,
  };
}

/** Lemniscate of Bernoulli: r² = a²·cos(2θ). */
export function lemniscate(scale = 1): CurveSpec {
  const fn: MathFunction = (t) => {
    const cos2t = Math.cos(2 * t);
    if (cos2t < 0) return { x: 0, y: 0 };
    const r = scale * Math.sqrt(cos2t);
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: "lemniscate",
    fn,
    domain: { min: -Math.PI / 2 + 0.01, max: Math.PI / 2 - 0.01 },
    closed: true,
    description: "Lemniscate of Bernoulli",
  };
}

/** Archimedean spiral: r = a + b·θ. */
export function spiral(a = 0, b = 0.15, turns = 3): CurveSpec {
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

/** Clover: r = a·cos(k·θ). */
export function clover(k = 3, amplitude = 1): CurveSpec {
  const fn: MathFunction = (t) => {
    const r = amplitude * Math.cos(k * t);
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: `clover_${k}`,
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: `Clover k=${k}`,
  };
}

/** Petal curve: r = a·sin(k·θ). */
export function petal(k = 5, amplitude = 1): CurveSpec {
  const fn: MathFunction = (t) => {
    const r = amplitude * Math.sin(k * t);
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: `petal_${k}`,
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: `Petal k=${k}`,
  };
}

/** Wave orbit: circular orbit modulated by a sine. */
export function waveOrbit(R = 1, waveAmplitude = 0.2, waveFrequency = 5): CurveSpec {
  const fn: MathFunction = (t) => {
    const r = R + waveAmplitude * Math.sin(waveFrequency * t);
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  };
  return {
    id: `wave_orbit_${R}_${waveFrequency}`,
    fn,
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: `Wave orbit R=${R} n=${waveFrequency}`,
  };
}