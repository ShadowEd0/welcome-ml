import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

// ---------------------------------------------------------------------------
// "Encre Vivante" — a text verso where the message feels written with ink
// that is still alive on a subtly organic paper.
//
// Rendering strategy (cheap + readable):
//   - the message is laid out once (wrapping + auto-fit) in CSS units;
//   - a low-resolution "ink density" grid is filled from that layout: every
//     grid cell knows whether it is letter ink or paper;
//   - each letter cell has its own random "birth" time, so traces appear as
//     scattered fragments (Phase 1), then the density rises and the shapes
//     converge into real letters (Phase 2), then settle (Phase 3);
//   - a crisp text layer is drawn on top, whose opacity rises during the
//     stabilisation, guaranteeing durable legibility;
//   - after t ≈ 4 s (Phase 4) a very subtle organic "micro-life" modulates the
//     ink density and the text breathing — barely perceptible, never chaotic.
//
// Lifecycle: one RAF while active, none while inactive, a static composition
// under reduced motion, complete cleanup on destroy. No pointer interaction:
// beauty and durability of the text take precedence over an optional hover.
// ---------------------------------------------------------------------------

// ---- palette (ink on light paper) ----
const INK_R = 54;
const INK_G = 52;
const INK_B = 62;
const PAPER_TOP = "#f0e9da";
const PAPER_MID = "#e7dcc3";
const PAPER_BOTTOM = "#d8c9a4";
const VIGNETTE_TOP = "rgba(148, 118, 82, 0)";
const VIGNETTE_MID = "rgba(138, 108, 72, 0.08)";
const VIGNETTE_EDGE = "rgba(112, 84, 50, 0.20)";

// ---- rendering grid ----
const CELL_PX = 3;
const GRID_MAX_W = 136;
const GRID_MAX_H = 200;
const DPR_MAX = 2;

// ---- typography ----
const FONT_FAMILY = "\"Cormorant Garamond\", Georgia, serif";
const LINE_HEIGHT_FACTOR = 1.24;
const BASELINE_FACTOR = 0.86;

// ---- timing (seconds) ----
const BIRTH_SPREAD = 1.5; // how staggered the per-cell births are
const RISE_SECONDS = 1.9; // density rise duration of one cell
const NET_RISE_START = 1.9; // crisp text layer starts to solidify
const NET_RISE_END = 3.3;
const MICRO_START = 3.6; // micro-life begins
const MICRO_VAR = 0.045; // ±4.5% ink density breathing

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Deterministic PRNG used to scatter cell birth times. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth, slowly evolving organic field in [-1, 1] used for micro-life. */
function microField(fx: number, fy: number, t: number): number {
  return (
    Math.sin(fx * Math.PI * 2 * 2.0 + t * 0.5) +
    Math.sin(fy * Math.PI * 2 * 2.0 + t * 0.4) +
    Math.sin((fx + fy) * Math.PI * 2 * 3.0 + t * 0.35)
  ) / 3;
}

interface InkTextLayout {
  font: number; // CSS px
  lineHeight: number; // CSS px
  lines: string[];
  blockH: number; // CSS px
  top: number; // CSS px, vertical offset of the block top
}

class InkTextScene implements VersoScene {
  readonly id = "ink_text";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private active = false;
  private reduced = false;
  private destroyed = false;

  private pw = 0;
  private ph = 0;
  private gw = 0;
  private gh = 0;

  private message = "";
  private layout: InkTextLayout | null = null;

  private paperGrad: CanvasGradient | null = null;
  private vigGrad: CanvasGradient | null = null;

  // density grid
  private ink: Float32Array | null = null;
  private target: Uint8Array | null = null;
  private birth: Float32Array | null = null;
  private image: ImageData | null = null;

  // small offscreen grid canvas used to sample the layout into `target`
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;
  // offscreen canvas the density ImageData is staged into before upscaling
  private sim: HTMLCanvasElement | null = null;

  private time = 0;
  private lastTime = 0;

  // ---- mount / resize -----------------------------------------------------

  mount({ host, message }: VersoSceneContext): void {
    this.host = host;
    this.message = (message ?? "").trim() || "…";

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

    const mask = document.createElement("canvas");
    mask.className = "verso-canvas";
    const maskCtx = mask.getContext("2d");
    if (maskCtx) {
      this.maskCanvas = mask;
      this.maskCtx = maskCtx;
    }

    this.resize();
    if (this.reduced) this.renderStatic();
  }

  resize(): void {
    const host = this.host;
    const canvas = this.canvas;
    if (!host || !canvas) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    this.pw = w;
    this.ph = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.gw = Math.max(8, Math.min(GRID_MAX_W, Math.floor(w / CELL_PX)));
    this.gh = Math.max(8, Math.min(GRID_MAX_H, Math.floor(h / CELL_PX)));

    this.layout = this.computeLayout(w, h);
    this.ensureBuffers();
    this.renderMaskToGrid();
    this.initBirth();
    this.buildBackground();

    if (this.reduced) this.renderStatic();
    else this.renderFrame();
  }
// ---- lifecycle ----------------------------------------------------------

  setActive(active: boolean): void {
    this.active = active;
    if (active && this.reduced) {
      this.renderStatic();
      return;
    }
    if (active) {
      this.time = 0;
      this.lastTime = performance.now() / 1000;
      if (this.rafId === null) this.rafId = requestAnimationFrame(this.frame);
    } else {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.renderStatic();
    }
  }

  setReducedMotion(reduced: boolean): void {
    if (this.reduced === reduced) return;
    this.reduced = reduced;
    if (reduced) {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.renderStatic();
    } else if (this.active && this.rafId === null) {
      this.time = 0;
      this.lastTime = performance.now() / 1000;
      this.rafId = requestAnimationFrame(this.frame);
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.canvas?.remove();
    this.maskCanvas?.remove();
    this.sim?.remove();
    this.canvas = null;
    this.ctx = null;
    this.maskCanvas = null;
    this.maskCtx = null;
    this.sim = null;
    this.ink = null;
    this.target = null;
    this.birth = null;
    this.image = null;
    this.paperGrad = null;
    this.vigGrad = null;
    this.layout = null;
    this.host = null;
  }

  // ---- animation ----------------------------------------------------------

  private frame = (now: number): void => {
    if (this.destroyed) {
      this.rafId = null;
      return;
    }
    if (!this.active || this.reduced) {
      this.rafId = null;
      return;
    }
    const nowSec = now / 1000;
    const dt = Math.min(0.1, nowSec - this.lastTime);
    this.lastTime = nowSec;
    this.time += dt;
    this.renderFrame();
    this.rafId = requestAnimationFrame(this.frame);
  };

  // ---- layout -------------------------------------------------------------

  private wrapWords(words: readonly string[], maxW: number, fontPx: number): string[] {
    const ctx = this.ctx;
    if (!ctx) return [];
    ctx.font = `${this.round1(fontPx)}px ${FONT_FAMILY}`;
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current.length === 0 ? word : `${current} ${word}`;
      if (ctx.measureText(candidate).width <= maxW) {
        current = candidate;
      } else if (current.length === 0) {
        // a single word wider than the line: force it through
        lines.push(word);
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines;
  }

  private computeLayout(w: number, h: number): InkTextLayout | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const availW = w * 0.82;
    const availH = h * 0.56;
    if (availW < 24 || availH < 24) return null;

    const words = this.message.split(/\s+/).filter((s) => s.length > 0);
    if (words.length === 0) return null;

    let font = Math.max(14, Math.min(availW * 0.48, availH * 0.3));
    let lines: string[] = [];
    let blockH = font;

    for (let guard = 0; guard < 30; guard++) {
      ctx.font = `${this.round1(font)}px ${FONT_FAMILY}`;
      lines = this.wrapWords(words, availW, font);
      const lineHeight = font * LINE_HEIGHT_FACTOR;
      blockH = lines.length * lineHeight;
      let maxW = 0;
      for (const line of lines) {
        const lw = ctx.measureText(line).width;
        if (lw > maxW) maxW = lw;
      }
      if (maxW <= availW && blockH <= availH) {
        return { font, lineHeight, lines, blockH, top: (h - blockH) * 0.5 };
      }
      const scale = Math.max(0.55, Math.min(availW / (maxW || 1), availH / (blockH || 1), 0.92));
      font *= scale;
    }
    // last resort: whatever we ended up with
    const lineHeight = font * LINE_HEIGHT_FACTOR;
    return { font, lineHeight, lines, blockH, top: (h - lines.length * lineHeight) * 0.5 };
  }

  private round1(v: number): number {
    return Math.max(1, Math.round(v * 10) / 10);
  }
// ---- grid sampling ------------------------------------------------------

  private ensureBuffers(): void {
    const gw = this.gw;
    const gh = this.gh;
    if (this.ink && this.target && this.birth && this.image &&
        this.ink.length === gw * gh) {
      return;
    }
    this.ink = new Float32Array(gw * gh);
    this.target = new Uint8Array(gw * gh);
    this.birth = new Float32Array(gw * gh);
    if (this.maskCanvas && this.maskCtx) {
      this.maskCanvas.width = gw;
      this.maskCanvas.height = gh;
      this.image = this.maskCtx.createImageData(gw, gh);
    } else {
      this.image = null;
    }
    if (!this.sim) {
      const sim = document.createElement("canvas");
      this.sim = sim;
    }
    this.sim.width = gw;
    this.sim.height = gh;
  }

  /** Draws the layout on the low-res grid canvas and samples letter cells. */
  private renderMaskToGrid(): void {
    const maskCtx = this.maskCtx;
    if (!maskCtx || !this.layout || !this.target) return;
    const gw = this.gw;
    const gh = this.gh;
    const fontG = this.layout.font * (gw / this.pw);
    const lineG = this.layout.lineHeight * (gh / this.ph);
    const topG = this.layout.top * (gh / this.ph);

    maskCtx.save();
    maskCtx.fillStyle = "#000";
    maskCtx.fillRect(0, 0, gw, gh);
    maskCtx.fillStyle = "#fff";
    maskCtx.font = `${this.round1(fontG)}px ${FONT_FAMILY}`;
    maskCtx.textAlign = "center";
    maskCtx.textBaseline = "alphabetic";
    const lines = this.layout.lines;
    for (let i = 0; i < lines.length; i++) {
      const y = topG + i * lineG + fontG * BASELINE_FACTOR;
      maskCtx.fillText(lines[i], gw / 2, y);
    }
    maskCtx.restore();

    const data = maskCtx.getImageData(0, 0, gw, gh).data;
    for (let i = 0; i < gw * gh; i++) {
      // opaque white = ink, checked by luminance
      this.target[i] = data[i * 4] > 128 && data[i * 4 + 3] > 128 ? 1 : 0;
    }
  }

  private initBirth(): void {
    if (!this.birth || !this.target) return;
    const n = this.gw * this.gh;
    const rng = mulberry32(1337);
    for (let i = 0; i < n; i++) {
      this.birth[i] = this.target[i] === 1 ? rng() * BIRTH_SPREAD : 0;
    }
  }

  private buildBackground(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0 || this.ph === 0) return;
    const paper = ctx.createLinearGradient(0, 0, 0, this.ph);
    paper.addColorStop(0, PAPER_TOP);
    paper.addColorStop(0.55, PAPER_MID);
    paper.addColorStop(1, PAPER_BOTTOM);
    const vig = ctx.createRadialGradient(
      this.pw / 2, this.ph / 2, Math.min(this.pw, this.ph) * 0.38,
      this.pw / 2, this.ph / 2, Math.max(this.pw, this.ph) * 0.72
    );
    vig.addColorStop(0, VIGNETTE_TOP);
    vig.addColorStop(0.55, VIGNETTE_MID);
    vig.addColorStop(1, VIGNETTE_EDGE);
    this.paperGrad = paper;
    this.vigGrad = vig;
  }
// ---- density + rendering ------------------------------------------------

  private densityAt(i: number, t: number): number {
    const target = this.target;
    const birth = this.birth;
    if (!target || !birth) return 0;
    if (target[i] === 0) return 0;
    const frac = clamp01((t - birth[i]) / RISE_SECONDS);
    let d = smoothstep(frac);
    if (t > MICRO_START) {
      const fx = (i % this.gw) / this.gw;
      const fy = (i / this.gw) / this.gh;
      d *= 1 + MICRO_VAR * microField(fx, fy, t);
    }
    return clamp01(d);
  }

  private bakeInk(): void {
    const image = this.image;
    if (!image) return;
    const data = image.data;
    const ink = this.ink;
    if (!ink) return;
    const n = this.gw * this.gh;
    for (let i = 0; i < n; i++) {
      const d = ink[i];
      const o = i * 4;
      if (d <= 0.004) {
        data[o] = 0;
        data[o + 1] = 0;
        data[o + 2] = 0;
        data[o + 3] = 0;
        continue;
      }
      data[o] = INK_R;
      data[o + 1] = INK_G;
      data[o + 2] = INK_B;
      data[o + 3] = d * 255;
    }
  }

  private drawInkLayer(): void {
    const ctx = this.ctx;
    const ink = this.ink;
    const image = this.image;
    if (!ctx || !ink || !image || this.gw === 0) return;
    const t = this.time;
    const n = this.gw * this.gh;
    for (let i = 0; i < n; i++) {
      ink[i] = this.densityAt(i, t);
    }
    this.bakeInk();
    const sim = this.sim;
    const simCtx = sim?.getContext("2d");
    if (simCtx && sim) {
      simCtx.putImageData(image, 0, 0);
      ctx.drawImage(sim, 0, 0, this.gw, this.gh, 0, 0, this.pw, this.ph);
    }
  }

  private drawTextLayer(): void {
    const ctx = this.ctx;
    const layout = this.layout;
    if (!ctx || !layout) return;
    const start = NET_RISE_START;
    const end = NET_RISE_END;
    let alpha = end > start ? smoothstep(clamp01((this.time - start) / (end - start))) : 0;
    if (alpha <= 0.004) return;

    if (this.time > MICRO_START) {
      alpha = Math.min(1, alpha * (1 + 0.015 * Math.sin(this.time * 0.6)));
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = `rgba(${INK_R - 8}, ${INK_G - 8}, ${INK_B - 8}, 1)`;
    ctx.font = `${this.round1(layout.font)}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const lines = layout.lines;
    for (let i = 0; i < lines.length; i++) {
      const y = layout.top + i * layout.lineHeight + layout.font * BASELINE_FACTOR;
      ctx.fillText(lines[i], this.pw / 2, y);
    }
    ctx.restore();
  }

  private renderFrame(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0 || this.ph === 0) return;
    ctx.fillStyle = this.paperGrad ?? PAPER_TOP;
    ctx.fillRect(0, 0, this.pw, this.ph);
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
    this.drawInkLayer();
    this.drawTextLayer();
  }

  /** Static, fully-formed composition (reduced motion / pause). */
  private renderStatic(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    this.time = NET_RISE_END + 1;
    ctx.fillStyle = this.paperGrad ?? PAPER_TOP;
    ctx.fillRect(0, 0, this.pw, this.ph);
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
    const ink = this.ink;
    const target = this.target;
    if (ink && target) {
      for (let i = 0; i < this.gw * this.gh; i++) ink[i] = target[i];
      this.bakeInk();
      const image = this.image;
      const sim = this.sim;
      const simCtx = sim?.getContext("2d");
      if (image && simCtx && sim) {
        simCtx.putImageData(image, 0, 0);
        this.ctx?.drawImage(sim, 0, 0, this.gw, this.gh, 0, 0, this.pw, this.ph);
      }
    }
    this.drawTextLayer();
  }
}

export const inkTextAnimation: VersoAnimationDefinition = {
  id: "ink_text",
  create: () => new InkTextScene(),
};