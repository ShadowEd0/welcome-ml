/**
 * Math Verso Engine — tracer abstraction.
 *
 * A tracer is a small luminous object that rides a curve. It only knows
 * its current parameter `t` and position; it never knows which curve
 * produced them. This keeps tracers interchangeable across scenes.
 */

import type { Tracer, WorldPoint } from "./types";

export interface TracerOptions {
  /** Visual radius in world units. */
  size?: number;
}

/**
 * A tracer that advances along a parameter domain at constant speed.
 *
 * The tracer is intentionally minimal: position is derived from the curve
 * each frame by the engine, so the tracer itself holds no curve reference.
 */
export class CurveTracer implements Tracer {
  t: number;
  position: WorldPoint;
  readonly size: number;

  constructor(t0 = 0, position: WorldPoint = { x: 0, y: 0 }, options: TracerOptions = {}) {
    this.t = t0;
    this.position = position;
    this.size = options.size ?? 0.06;
  }

  /** Advance the parameter by `dt` seconds at the given speed. */
  advance(dt: number, speed: number): void {
    this.t += dt * speed;
  }

  /** Set the tracer position (called by the engine after advancing). */
  setPosition(p: WorldPoint): void {
    this.position = p;
  }
}

/**
 * Wrap a parameter into [min, max).
 * Used when the tracer loops over a finite domain.
 */
export function wrapT(t: number, min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return min;
  let result = t;
  while (result >= max) result -= range;
  while (result < min) result += range;
  return result;
}

/**
 * Clamp a parameter into [min, max].
 * Used when the tracer should stop at the domain boundary.
 */
export function clampT(t: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, t));
}
