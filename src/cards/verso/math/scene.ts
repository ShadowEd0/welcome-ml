/**
 * Math Verso Engine — MathScene.
 *
 * MathScene is the bridge between the engine and the verso contract
 * (VersoScene). It owns the canvas, the RAF loop, the lifecycle, and
 * adapts the engine to the verso renderer.
 *
 * This is the ONLY class that touches React-adjacent concerns. The engine
 * itself stays pure Canvas + math.
 */

import type { VersoScene, VersoSceneContext } from "../types";
import type { MathVersoConfig } from "./types";
import { MathEngine } from "./engine";

export class MathScene implements VersoScene {
  readonly id: string;

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private engine: MathEngine | null = null;

  private rafId: number | null = null;
  private active = false;
  private reduced = false;
  private lastTime = 0;

  constructor(config: MathVersoConfig) {
    this.id = config.id;
    this.config = config;
  }

  private readonly config: MathVersoConfig;

  mount({ host }: VersoSceneContext): void {
    this.host = host;

    const canvas = document.createElement("canvas");
    canvas.className = "verso-canvas";
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return;
    }

    host.appendChild(canvas);
    this.canvas = canvas;
    this.engine = new MathEngine(this.config, canvas, ctx, {
      showFrame: true,
      frameColor: "#caa6ff",
    });

    this.resize();

    // Paint a first static frame immediately so the back face is never
    // blank (important when host starts hidden or reduced motion is on).
    this.engine.renderStatic();
  }

  setActive(active: boolean): void {
    this.active = active;
    if (active && this.rafId === null && !this.reduced) {
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.frame);
    } else if (!active && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
    if (reduced) {
      // Stop the loop; paint a static composition once.
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.engine?.renderStatic();
    } else if (this.active) {
      // Resume the loop if active.
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  resize(): void {
    const host = this.host;
    const engine = this.engine;
    if (!host || !engine) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) return;
    engine.resize(width, height);
    // Repaint immediately so no blank canvas appears mid-resize.
    if (this.reduced || !this.active) {
      engine.renderStatic();
    }
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.canvas?.remove();
    this.canvas = null;
    this.engine = null;
    this.host = null;
  }

  private frame = (now: number): void => {
    if (!this.active || this.reduced) {
      this.rafId = null;
      return;
    }
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.engine?.step(dt);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
