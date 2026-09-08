/**
 * Math Verso Engine — orchestrator.
 *
 * The engine ties together the coordinate system, the composition, the
 * tracer, the trail and the renderer. It is the single entry point a
 * scene uses each frame. The engine owns no React lifecycle: the scene
 * creates it, feeds it a canvas, and calls `step(dt)` / `resize()`.
 *
 * The engine is deliberately small: it advances the tracer, records the
 * trail, and asks the renderer to paint. All the interesting work lives
 * in the pure modules (functions, sampling, coordinates).
 *
 * Progressive drawing (M26):
 *  - Each layer has a reveal timeline (delay/stagger/duration/easing).
 *  - While a layer is building, its tracer (if any) becomes the "pen":
 *    it is driven to exactly the reveal front, so the curve materializes
 *    under the luminous dot and the two never disagree.
 *  - The renderer receives a per-layer point count (reused buffer, no
 *    allocation) instead of new geometry.
 *  - Static renders (reduced motion) always show the full composition.
 */

import type {
  CurveLayer,
  MathVersoConfig,
  RevealEasing,
  SampledCurve,
  Trail,
  Tracer,
  WorldPoint,
} from "./types";
import { applyTransform } from "./types";
import {
  type CoordinateSystem,
  createCoordinateSystem,
  drawFrame,
} from "./coordinates";
import { wrapT } from "./tracer";
import { renderFrame } from "./renderer";

export interface EngineOptions {
  /** Show the reference frame. */
  showFrame?: boolean;
  /** Frame color. */
  frameColor?: string;
}

/** Resolved progressive-drawing profile for one layer. */
interface RevealProfile {
  readonly start: number;
  readonly duration: number;
  readonly easing: RevealEasing;
}

const DEFAULT_REVEAL_DURATION = 3.2;
const DEFAULT_REVEAL_STAGGER = 0.28;
const DEFAULT_REVEAL_EASING: RevealEasing = "easeInOut";

function ease(p: number, kind: RevealEasing): number {
  switch (kind) {
    case "linear":
      return p;
    case "easeOut":
      return 1 - Math.pow(1 - p, 3);
    case "easeInOut":
    default:
      return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  }
}

/**
 * A ready-to-run mathematical verso engine.
 *
 * Usage:
 *   const engine = new MathEngine(config, canvas, ctx);
 *   engine.resize();
 *   // each frame:
 *   engine.step(dtSeconds);
 */
export class MathEngine {
  private readonly config: MathVersoConfig;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly options: EngineOptions;

  private readonly worldRadius: number;
  private readonly revealEnabled: boolean;
  private readonly revealProfiles: readonly RevealProfile[];

  private cs: CoordinateSystem;
  /** Per-layer point counts for the current frame (reused, no allocation). */
  private readonly drawCounts: number[];
  private width = 0;
  private height = 0;
  private time = 0;
  private dpr = 1;

  constructor(
    config: MathVersoConfig,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    options: EngineOptions = {}
  ) {
    this.config = config;
    this.canvas = canvas;
    this.ctx = ctx;
    this.options = options;

    const layers = config.composition.layers;
    this.drawCounts = new Array<number>(layers.length);

    // Calibration: the widest the composition ever reaches (after its
    // world transforms). Used as the auto-fit radius so curves like the
    // golden spiral or a large hypotrochoid never overflow the card.
    this.worldRadius = computeWorldRadius(layers);

    // Progressive-drawing profile.
    const reveal = config.reveal ?? {};
    this.revealEnabled = reveal.enabled ?? true;
    const globalDuration = reveal.duration ?? DEFAULT_REVEAL_DURATION;
    const globalStagger = reveal.stagger ?? DEFAULT_REVEAL_STAGGER;
    const globalEasing = reveal.easing ?? DEFAULT_REVEAL_EASING;
    this.revealProfiles = layers.map((layer, i) => ({
      start: i * globalStagger + (layer.reveal?.delay ?? 0),
      duration: layer.reveal?.duration ?? globalDuration,
      easing: layer.reveal?.easing ?? globalEasing,
    }));

    // Pre-sample all curves once.
    this.cs = createCoordinateSystem(1, 1);
  }

  /** Current viewport width in CSS pixels. */
  get viewportWidth(): number {
    return this.width;
  }

  /** Current viewport height in CSS pixels. */
  get viewportHeight(): number {
    return this.height;
  }

  /** Current coordinate system (read-only access for the scene). */
  get coordinateSystem(): CoordinateSystem {
    return this.cs;
  }

  /** Current animation time in seconds. */
  get currentTime(): number {
    return this.time;
  }

  /**
   * Rebuild the coordinate system and re-sample curves for a new size.
   * Called on mount and on every resize. The scale is derived from both the
   * viewport and the composition's peak world radius (calibration guard).
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.cs = createCoordinateSystem(width, height, 0.08, this.worldRadius);

    // Clear trails on resize (positions would be stale).
    this.config.trail?.clear();
    for (const layer of this.config.composition.layers) {
      layer.trail?.clear();
    }
  }

  /**
   * Fraction (0..1) of a layer that should be visible at `time`.
   * Reveal is off outside the [start, start+duration] window.
   */
  private revealProgress(index: number, time: number): number {
    if (!this.revealEnabled) return 1;
    const profile = this.revealProfiles[index];
    const raw = (time - profile.start) / profile.duration;
    if (raw <= 0) return 0;
    if (raw >= 1) return 1;
    return ease(raw, profile.easing);
  }

  /**
   * Advance one tracer. Before its reveal finishes the tracer is driven to
   * the reveal front (pen mode); afterwards it resumes its own motion.
   */
  private updateTracer(
    tracer: Tracer,
    trail: Trail | undefined,
    curve: SampledCurve,
    time: number,
    dt: number,
    progress: number
  ): void {
    const { min, max } = curve.spec.domain;
    if (progress < 1) {
      const tPen = min + (max - min) * progress;
      tracer.t = tPen;
      const pos: WorldPoint = curve.fn(tPen);
      tracer.setPosition(pos);
      trail?.record(pos, time);
      return;
    }
    tracer.advance(dt, this.config.tracerSpeed);
    if (this.config.tracerLoops) {
      tracer.t = wrapT(tracer.t, min, max);
    } else {
      tracer.t = Math.max(min, Math.min(max, tracer.t));
    }
    const worldPos: WorldPoint = curve.fn(tracer.t);
    tracer.setPosition(worldPos);
    trail?.record(worldPos, time);
  }

  /**
   * Advance the simulation by `dt` seconds and render one frame.
   *
   * The engine:
   *   1. resolves each layer's reveal progress;
   *   2. moves the tracer (driven by reveal while building, free after);
   *   3. evaluates the tracer's curve at the new parameter;
   *   4. records the trail(s) (in world space);
   *   5. renders the full frame.
   */
  step(dt: number): void {
    this.time += dt;
    const layers = this.config.composition.layers;

    // Per-layer reveal + tracer update.
    for (let li = 0; li < layers.length; li++) {
      const layer = layers[li];
      const progress = this.revealProgress(li, this.time);
      const n = layer.curve.points.length;
      this.drawCounts[li] = n <= 1 ? n : Math.min(n, Math.round(progress * (n - 1)) + 1);
      if (layer.tracer) {
        this.updateTracer(layer.tracer, layer.trail, layer.curve, this.time, dt, progress);
      }
    }

    // Global tracer on the first layer (backward-compatible with roseGarden).
    const tracer = this.config.tracer;
    const firstLayer = layers[0];
    if (tracer && firstLayer) {
      this.updateTracer(
        tracer,
        this.config.trail,
        firstLayer.curve,
        this.time,
        dt,
        layers.length > 0 ? this.revealProgress(0, this.time) : 1
      );
    }

    // Paint.
    renderFrame(this.ctx, this.width, this.height, this.time, this.cs, this.config, this.drawCounts);

    // Optional reference frame on top.
    if (this.options.showFrame) {
      drawFrame(this.ctx, this.cs, this.options.frameColor ?? "#ffffff", 0.12);
    }
  }

  /**
   * Render a static frame (for reduced motion).
   * Paints universe + composition + tracer at rest, all curves fully
   * visible — progressive drawing is an animation-only effect.
   */
  renderStatic(): void {
    renderFrame(this.ctx, this.width, this.height, this.time, this.cs, this.config);
    if (this.options.showFrame) {
      drawFrame(this.ctx, this.cs, this.options.frameColor ?? "#ffffff", 0.12);
    }
  }

  /** Reset the simulation time, all tracers and all trails to the start. */
  reset(): void {
    this.time = 0;
    this.config.trail?.clear();
    for (const layer of this.config.composition.layers) {
      layer.trail?.clear();
      if (layer.tracer) {
        const { min } = layer.curve.spec.domain;
        layer.tracer.t = min;
        layer.tracer.setPosition(layer.curve.fn(min));
      }
    }
    if (this.config.tracer && this.config.composition.layers[0]) {
      const { min } = this.config.composition.layers[0].curve.spec.domain;
      this.config.tracer.t = min;
      const p: WorldPoint = this.config.composition.layers[0].curve.fn(min);
      this.config.tracer.setPosition(p);
    }
  }
}

/** Peak world-space distance of a composition from the origin (after transforms). */
function computeWorldRadius(layers: readonly CurveLayer[]): number {
  let radius = 0.01;
  for (const layer of layers) {
    for (const pt of layer.curve.points) {
      const p = applyTransform(pt, layer.transform);
      const d = Math.hypot(p.x, p.y);
      if (d > radius) radius = d;
    }
  }
  return radius;
}

export type { SampledCurve };