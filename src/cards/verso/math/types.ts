/**
 * Math Verso Engine — pure types.
 *
 * These types describe the mathematical grammar shared by all future
 * mathematical verso scenes. They are deliberately independent of Canvas,
 * React, the DOM and the verso lifecycle: a scene composes them, but they
 * know nothing about how they are rendered.
 */

import type { CoordinateSystem } from "./coordinates";

/** A point in mathematical (world) coordinates. */
export interface WorldPoint {
  readonly x: number;
  readonly y: number;
}

/** A point in screen (pixel) coordinates. */
export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A mathematical function produces a world point from a parameter `t`.
 *
 * This single protocol covers every curve family the engine will ever need:
 *   - parametric curves:      (x(t), y(t))
 *   - polar curves:           (r(t)·cos(t), r(t)·sin(t))
 *   - cartesian curves:       (t, f(t))
 *   - Lissajous, roses, spirals, cardioids, lemniscates, …
 *
 * The function is pure: same `t` → same point. No internal state, no
 * side effects. This allows scenes to pre-sample a curve once and reuse
 * the points across frames.
 */
export type MathFunction = (t: number) => WorldPoint;

/** Domain of the parameter `t` for sampling a curve. */
export interface TDomain {
  readonly min: number;
  readonly max: number;
}

/**
 * Sampling descriptor: how densely a curve is discretised into points.
 *
 * `count` is the number of samples; the domain is divided into `count`
 * evenly spaced values of `t`. For closed curves (rose, cardioid, …) the
 * caller typically chooses a domain that completes one period.
 */
export interface SamplingSpec {
  readonly domain: TDomain;
  readonly count: number;
}

/**
 * A sampled curve: a polyline in world coordinates plus its original
 * definition. Scenes receive this from the engine and never re-sample
 * per frame unless the viewport changes.
 */
export interface SampledCurve {
  readonly fn: MathFunction;
  readonly spec: SamplingSpec;
  readonly points: readonly WorldPoint[];
  /** True when the curve returns to its start (closed path). */
  readonly closed: boolean;
}

/** A named curve: its function plus the canonical domain for one period. */
export interface CurveSpec {
  readonly id: string;
  readonly fn: MathFunction;
  readonly domain: TDomain;
  /** True when the curve closes on itself over its canonical domain. */
  readonly closed: boolean;
  /** Human-readable description (for tooling / documentation). */
  readonly description: string;
}

/** Sampled curve: a polyline in world coordinates plus its original definition. */
export interface SampledCurve {
  readonly fn: MathFunction;
  readonly spec: SamplingSpec;
  readonly points: readonly WorldPoint[];
  /** True when the curve returns to its start (closed path). */
  readonly closed: boolean;
}

/**
 * 2D affine transformation applied to a curve in world space.
 *
 * Order of application (mathematical convention):
 *   1. Scale
 *   2. Mirror (X then Y)
 *   3. Rotate
 *   4. Translate
 */
export interface Transform2D {
  readonly scale?: number | { x: number; y: number };
  readonly mirrorX?: boolean;
  readonly mirrorY?: boolean;
  readonly rotation?: number;
  readonly translation?: WorldPoint;
}

/** Apply a Transform2D to a WorldPoint (returns a new point). */
export function applyTransform(p: WorldPoint, t?: Transform2D): WorldPoint {
  if (!t) return p;

  let sx = 1, sy = 1;
  if (typeof t.scale === "number") {
    sx = t.scale;
    sy = t.scale;
  } else if (t.scale) {
    sx = t.scale.x;
    sy = t.scale.y;
  }
  let x = p.x * sx;
  let y = p.y * sy;

  if (t.mirrorX) x = -x;
  if (t.mirrorY) y = -y;

  if (t.rotation) {
    const c = Math.cos(t.rotation);
    const s = Math.sin(t.rotation);
    [x, y] = [x * c - y * s, x * s + y * c];
  }

  if (t.translation) {
    x += t.translation.x;
    y += t.translation.y;
  }

  return { x, y };
}

/**
 * A drawable element inside a composition: a curve + its visual role +
 * an optional transformation applied in world space.
 */
export interface CurveLayer {
  readonly id: string;
  readonly curve: SampledCurve;
  readonly color: string;
  readonly lineWidth?: number;
  readonly glow?: number;
  readonly transform?: Transform2D;
  readonly tracer?: Tracer;
  readonly trail?: Trail;
}

/**
 * A mathematical composition: a set of curves drawn together.
 *
 * The composition is the scene's "what". The engine renders it; the scene
 * owns the lifecycle. Multiple curves can share the world (e.g. a rose
 * inside a spiral) and each keeps its own color/role.
 */
export interface MathComposition {
  readonly layers: readonly CurveLayer[];
}

/**
 * Tracer abstraction.
 *
 * A tracer is a small luminous object that rides a curve at parameter
 * `t`. It only needs a position to draw itself; it never knows which
 * curve produced that position.
 *
 * The engine calls `advance(dt, speed)` and `setPosition(p)` each frame;
 * concrete tracers (like CurveTracer) implement them. The interface exposes
 * `t` and `position` as writable so the engine can mutate them without
 * downcasting.
 *
 * A tracer MAY optionally implement `render(ctx, cs, time)` to control its
 * own appearance. When present, the renderer delegates to it; otherwise a
 * soft glowing dot is drawn. The tracer never owns a RAF, timer or listener:
 * `render()` is invoked by the renderer with an explicit time argument.
 */
export interface Tracer {
  /** Current parameter along the host curve. */
  t: number;
  /** Current position in world coordinates. */
  position: WorldPoint;
  /** Visual size in world units (used by the renderer). */
  readonly size: number;
  /** Advance the parameter by `dt` seconds at the given speed (rad/s). */
  advance(dt: number, speed: number): void;
  /** Update the tracer's position after advancing. */
  setPosition(p: WorldPoint): void;
  /**
   * Optional self-rendering. When implemented, the renderer calls this
   * instead of the default glowing dot. Receives the canvas context, the
   * coordinate system, and the current animation time in seconds.
   *
   * Implementations must NOT create RAF, timers, listeners or persistent
   * resources. They paint using only the provided context and time.
   */
  render?(ctx: CanvasRenderingContext2D, cs: CoordinateSystem, time: number): void;
}

/**
 * Trail abstraction.
 *
 * A trail is a fading history of recent tracer positions. It decouples
 * the "what is left behind" from the tracer itself, so trails are
 * interchangeable plugins.
 *
 * The engine records positions in WORLD coordinates (resize-safe). The
 * renderer hands the coordinate system and current time to `render()`, so
 * each trail can convert to screen space and animate itself.
 */
export interface Trail {
  /** Record a new tracer position (called once per frame). */
  readonly record: (point: WorldPoint, time: number) => void;
  /** Render the trail. Receives the context, coordinate system and time. */
  readonly render: (
    ctx: CanvasRenderingContext2D,
    cs: CoordinateSystem,
    time: number
  ) => void;
  /** Clear all history (used on resize / destroy). */
  readonly clear: () => void;
  /** Current opacity multiplier (0..1), useful for fade-out. */
  readonly opacity: number;
}

/**
 * Universe / background abstraction.
 *
 * An universe is the atmospheric backdrop of a mathematical verso. It is
 * independent of the composition: a universe draws first, the composition
 * draws on top. It may be a static gradient, a subtle starfield, a slow
 * nebula — the engine only requires it to fill the background.
 */
export interface Universe {
  /** Paint the background. Called once per frame, before the composition. */
  readonly paint: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    time: number
  ) => void;
  /**
   * True when the universe itself animates continuously (e.g. drifting
   * stars). When false AND reduced motion is on, the universe may paint
   * only once.
   */
  readonly animates: boolean;
}

/**
 * Configuration for a single mathematical verso scene.
 *
 * A scene is built from exactly these ingredients. Adding a new verso
 * means building a new config — never a new scene class.
 */
export interface MathVersoConfig {
  readonly id: string;
  readonly composition: MathComposition;
  readonly tracer?: Tracer;
  readonly trail?: Trail;
  readonly universe: Universe;
    /** Tracer motion: how `t` advances per second. */
  readonly tracerSpeed: number;
  /** Whether the tracer loops at the end of its domain. */
  readonly tracerLoops: boolean;
  /** Optional color override for the global tracer (default #ffffff). */
  readonly tracerColor?: string;
}
