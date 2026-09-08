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
 */

import type {
  MathVersoConfig,
  SampledCurve,
  WorldPoint,
} from "./types";
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

  private cs: CoordinateSystem;
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
   * Called on mount and on every resize.
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

    this.cs = createCoordinateSystem(width, height);

        // Clear trails on resize (positions would be stale).
    this.config.trail?.clear();
    for (const layer of this.config.composition.layers) {
      layer.trail?.clear();
    }
  }

  /**
   * Advance the simulation by `dt` seconds and render one frame.
   *
   * The engine:
   *   1. advances the tracer parameter(s);
   *   2. evaluates the tracer's curve at the new parameter;
   *   3. records the trail(s) (in world space);
   *   4. renders the full frame.
   */
  step(dt: number): void {
    this.time += dt;

    // Global tracer on the first layer (backward-compatible with roseGarden)
    const tracer = this.config.tracer;
    const firstLayer = this.config.composition.layers[0];

    if (tracer && firstLayer) {
      tracer.advance(dt, this.config.tracerSpeed);
      const { min, max } = firstLayer.curve.spec.domain;
      if (this.config.tracerLoops) {
        tracer.t = wrapT(tracer.t, min, max);
      } else {
        tracer.t = Math.max(min, Math.min(max, tracer.t));
      }
      const worldPos: WorldPoint = firstLayer.curve.fn(tracer.t);
      tracer.setPosition(worldPos);
      this.config.trail?.record(worldPos, this.time);
    }

    // Per-layer tracers (independent state)
    for (const layer of this.config.composition.layers) {
      if (layer.tracer) {
        layer.tracer.advance(dt, this.config.tracerSpeed);
        const { min, max } = layer.curve.spec.domain;
        if (this.config.tracerLoops) {
          layer.tracer.t = wrapT(layer.tracer.t, min, max);
        } else {
          layer.tracer.t = Math.max(min, Math.min(max, layer.tracer.t));
        }
        const worldPos: WorldPoint = layer.curve.fn(layer.tracer.t);
        layer.tracer.setPosition(worldPos);
        layer.trail?.record(worldPos, this.time);
      }
    }

    // Paint.
    renderFrame(this.ctx, this.width, this.height, this.time, this.cs, this.config);

    // Optional reference frame on top.
    if (this.options.showFrame) {
      drawFrame(this.ctx, this.cs, this.options.frameColor ?? "#ffffff", 0.12);
    }
  }

  /**
   * Render a static frame (for reduced motion).
   * Paints universe + composition + tracer at rest, no trail animation.
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

export type { SampledCurve };
