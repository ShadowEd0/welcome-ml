import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

const FALLBACK_GLOW = "#b49cff";
const FALLBACK_ACCENT = "#caa6ff";

/**
 * Validation scene for the verso contract — not artistic production.
 *
 * "breathing_rings": a gently breathing luminous halo. Three concentric
 * rings swell out of phase around a soft radial glow. The pointer gently
 * pulls the halo's center (interaction as a natural consequence of the
 * phenomenon — here a light drift). With prefers-reduced-motion the
 * universe becomes almost static: a single still ring.
 *
 * Exercises the full contract: canvas 2D, an RAF loop driven by setActive,
 * resize, palette read from inherited custom properties (--u-acc./--u-glow),
 * reduced-motion adaptation, and complete cleanup on destroy.
 */
class BreathingRingsScene implements VersoScene {
  readonly id = "breathing_rings";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private active = false;
  private reduced = false;
  private width = 0;
  private height = 0;
  private pointer = { x: 0.5, y: 0.5 };
  private readonly onPointerMove: (event: PointerEvent) => void;

  constructor() {
    this.onPointerMove = (event: PointerEvent) => {
      const host = this.host;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      this.pointer = {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
    };
  }

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
    this.ctx = ctx;

    host.addEventListener("pointermove", this.onPointerMove, { passive: true });
    this.resize();
  }

  setActive(active: boolean): void {
    this.active = active;
    if (active && this.rafId === null) {
      this.rafId = requestAnimationFrame(this.frame);
    } else if (!active && this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.reduced = reduced;
  }

  resize(): void {
    const host = this.host;
    const canvas = this.canvas;
    if (!host || !canvas) return;
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.width = width;
    this.height = height;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.host) {
      this.host.removeEventListener("pointermove", this.onPointerMove);
    }
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.host = null;
  }

  private frame = (now: number): void => {
    if (!this.active) {
      this.rafId = null;
      return;
    }
    this.draw(now / 1000);
    this.rafId = requestAnimationFrame(this.frame);
  };

  private palette(): { glow: string; accent: string } {
    if (!this.host) return { glow: FALLBACK_GLOW, accent: FALLBACK_ACCENT };
    const style = getComputedStyle(this.host);
    const glow = style.getPropertyValue("--u-glow").trim() || FALLBACK_GLOW;
    const accent = style.getPropertyValue("--u-accent").trim() || FALLBACK_ACCENT;
    return { glow, accent };
  }

  private draw(time: number): void {
    const ctx = this.ctx;
    if (!ctx || this.width === 0 || this.height === 0) return;
    const { glow, accent } = this.palette();
    const cx = this.width / 2 + (this.pointer.x - 0.5) * this.width * 0.16;
    const cy = this.height / 2 + (this.pointer.y - 0.5) * this.height * 0.16;
    const base = Math.min(this.width, this.height) * 0.24;

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.lineCap = "round";
    ctx.lineWidth = 1.5;

    if (this.reduced) {
      ctx.beginPath();
      ctx.arc(this.width / 2, this.height / 2, base, 0, Math.PI * 2);
      ctx.strokeStyle = glow;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    const inner = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 1.2);
    inner.addColorStop(0, accent);
    inner.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(cx, cy, base * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (let i = 0; i < 3; i++) {
      const breath = Math.sin(time * 0.7 + i * 1.9) * 0.12;
      ctx.beginPath();
      ctx.arc(cx, cy, base * (1 + breath), 0, Math.PI * 2);
      ctx.strokeStyle = glow;
      ctx.globalAlpha = 0.55 - i * 0.15;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

export const breathingRingsAnimation: VersoAnimationDefinition = {
  id: "breathing_rings",
  create: () => new BreathingRingsScene(),
};