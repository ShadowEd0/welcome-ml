import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

// ---------------------------------------------------------------------------
// "Métamorphose" (morph_text) — a refined typographic metamorphosis.
//
// Identity (distinct from the other text scenes): the message first exists
// only as an abstract living structure — short monoline strokes oriented by
// a slow flow field (Phase 1: forme abstraite). The strokes then gradually
// align with the true letter positions and orientations (Phase 2: structure
// -> lettres), the matter solidifies into a crisp pearl text layer
// (Phase 3: composition finale) and keeps a barely perceptible breathing
// (Phase 4: micro-vie). No glitch, no chaos, durable legibility.
//
// Rendering strategy (cheap + readable), same proven grid approach as
// ink_text: the message is laid out once and sampled into a low-res grid of
// letter cells; the whole structure phase is drawn as ONE stroked path per
// frame (O(N) with zero per-cell state changes); the crisp text layer
// guarantees durable legibility once formed.
//
// Lifecycle: one RAF while active, none while inactive, a static composition
// under reduced motion, complete cleanup on destroy. No pointer interaction.
// ---------------------------------------------------------------------------

// ---- palette (deep forest night, sage structure, pearl text) ----
const BG_TOP = "#12201b";
const BG_MID = "#0b1512";
const BG_DEEP = "#050b09";
const HALO_IN = "rgba(150, 202, 170, 0.07)";
const HALO_OUT = "rgba(150, 202, 170, 0)";
const VIGNETTE = "rgba(0, 0, 0, 0.30)";
const STROKE_R = 196; const STROKE_G = 224; const STROKE_B = 200;
const CRISP_TEXT = "#dcead9";

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
const STRUCT_IN = 0.8;        // structure fade-in duration
const MORPH_DELAY = 1.2;      // first strokes start aligning here
const MORPH_SPREAD = 1.2;     // stagger of the alignment
const MORPH_DUR = 1.2;        // one stroke alignment duration
const NET_START = 3.0;        // crisp text layer starts to solidify
const NET_END = 4.0;
const DASH_FADE_START = 3.2;  // structure dissolves into the letters
const MICRO_START = 4.2;      // micro-life begins
const FLOW_AMP = 0.10;        // flow displacement amplitude (grid widths)
const BREATH_VAR = 0.015;     // ±1.5% text breathing after stabilisation

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Deterministic PRNG (same family as the other text scenes). */
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

interface MorphTextLayout {
  font: number;
  lineHeight: number;
  lines: string[];
  blockH: number;
  top: number;
}

class MorphTextScene implements VersoScene {
  readonly id = "morph_text";

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
  private layout: MorphTextLayout | null = null;

  private bgGrad: CanvasGradient | null = null;
  private haloGrad: CanvasGradient | null = null;
  private vigGrad: CanvasGradient | null = null;


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
    this.renderMaskToGrid();
    this.initStrokes();
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
    this.canvas = null;
    this.ctx = null;
    this.maskCanvas = null;
    this.maskCtx = null;
    this.tx = null;
    this.ty = null;
    this.delay = null;
    this.phase = null;
    this.fx = null;
    this.fy = null;
    this.target = null;
    this.bgGrad = null;
    this.haloGrad = null;
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

  // stroke buffers (letter cells only, no per-frame allocation)
  private cellCount = 0;
  private tx: Float32Array | null = null;   // letter position (grid units)
  private ty: Float32Array | null = null;
  private delay: Float32Array | null = null;  // alignment start time
  private phase: Float32Array | null = null;  // per-cell flow phase
  private fx: Float32Array | null = null;     // normalised position x (field)
  private fy: Float32Array | null = null;     // normalised position y (field)

  private target: Uint8Array | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;

  private time = 0;
  private lastTime = 0;


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
        lines.push(word);
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current.length > 0) lines.push(current);
    return lines;
  }

  private computeLayout(w: number, h: number): MorphTextLayout | null {
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
    const lineHeight = font * LINE_HEIGHT_FACTOR;
    return { font, lineHeight, lines, blockH, top: (h - lines.length * lineHeight) * 0.5 };
  }

  private round1(v: number): number {
    return Math.max(1, Math.round(v * 10) / 10);
  }

  // ---- grid sampling ------------------------------------------------------

  /** Draws the layout on the low-res grid canvas and samples letter cells. */
  private renderMaskToGrid(): void {
    const maskCtx = this.maskCtx;
    if (!maskCtx || !this.layout) return;
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
    const n = gw * gh;
    if (!this.target || this.target.length !== n) {
      this.target = new Uint8Array(n);
    }
    for (let i = 0; i < n; i++) {
      this.target[i] = data[i * 4] > 128 && data[i * 4 + 3] > 128 ? 1 : 0;
    }
  }

  /**
   * Builds the stroke buffers: every letter cell gets an alignment delay, a
   * flow phase and its normalised position (used by the flow field).
   * Deterministic (same layout -> same choreography).
   */
  private initStrokes(): void {
    const target = this.target;
    if (!target) return;
    const gw = this.gw;
    const gh = this.gh;
    const n = gw * gh;

    let count = 0;
    for (let i = 0; i < n; i++) if (target[i] === 1) count++;
    this.cellCount = count;
    if (count === 0) return;

    if (!this.tx || this.tx.length !== count) {
      this.tx = new Float32Array(count);
      this.ty = new Float32Array(count);
      this.delay = new Float32Array(count);
      this.phase = new Float32Array(count);
      this.fx = new Float32Array(count);
      this.fy = new Float32Array(count);
    }

    const rng = mulberry32(9021);
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (target[i] !== 1) continue;
      this.tx![k] = (i % gw) + 0.5;
      this.ty![k] = Math.floor(i / gw) + 0.5;
      this.fx![k] = this.tx![k]! / gw;
      this.fy![k] = this.ty![k]! / gh;
      this.delay![k] = MORPH_DELAY + rng() * MORPH_SPREAD;
      this.phase![k] = rng() * Math.PI * 2;
      k++;
    }
  }

  private buildBackground(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0 || this.ph === 0) return;
    const bg = ctx.createLinearGradient(0, 0, 0, this.ph);
    bg.addColorStop(0, BG_TOP);
    bg.addColorStop(0.55, BG_MID);
    bg.addColorStop(1, BG_DEEP);
    const halo = ctx.createRadialGradient(
      this.pw / 2, this.ph / 2, 0,
      this.pw / 2, this.ph / 2, Math.max(this.pw, this.ph) * 0.62
    );
    halo.addColorStop(0, HALO_IN);
    halo.addColorStop(1, HALO_OUT);
    const vig = ctx.createRadialGradient(
      this.pw / 2, this.ph / 2, Math.min(this.pw, this.ph) * 0.40,
      this.pw / 2, this.ph / 2, Math.max(this.pw, this.ph) * 0.74
    );
    vig.addColorStop(0, "rgba(0, 0, 0, 0)");
    vig.addColorStop(1, VIGNETTE);
    this.bgGrad = bg;
    this.haloGrad = halo;
    this.vigGrad = vig;
  }


  // ---- rendering ----------------------------------------------------------

  /**
   * The structure: every letter cell is a short stroke, oriented by a slow
   * flow field while abstract, gradually aligning to the horizontal letter
   * position. Drawn as ONE stroked path per frame (O(N), no state changes).
   */
  private drawStructure(): void {
    const ctx = this.ctx;
    const tx = this.tx;
    const ty = this.ty;
    const delay = this.delay;
    const phase = this.phase;
    const fx = this.fx;
    const fy = this.fy;
    if (!ctx || !tx || !ty || !delay || !phase || !fx || !fy) return;
    if (this.cellCount === 0 || this.gw === 0) return;

    const t = this.time;
    // global fade-in then dissolve into the letters
    const aIn = smoothstep(clamp01(t / STRUCT_IN)) * 0.55;
    const aOut = 1 - smoothstep(clamp01((t - DASH_FADE_START) / (NET_END - DASH_FADE_START)));
    const alpha = aIn * aOut;
    if (alpha <= 0.004) return;

    const amp = FLOW_AMP * this.gw;
    const cellW = this.pw / this.gw;
    const cellH = this.ph / this.gh;
    const halfBase = cellW * 0.78;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgb(${STROKE_R}, ${STROKE_G}, ${STROKE_B})`;
    ctx.lineWidth = Math.max(1, cellW * 0.34);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let k = 0; k < this.cellCount; k++) {
      const m = smoothstep(clamp01((t - delay[k]!) / MORPH_DUR));
      const inv = 1 - m;
      // flow displacement, fading out as the stroke aligns
      const ox = Math.sin(fx[k]! * 5.2 + t * 0.5 + phase[k]!) * amp * inv;
      const oy = Math.cos(fy[k]! * 4.4 + t * 0.42 + phase[k]! * 1.3) * amp * inv;
      const x = (tx[k]! + ox) * cellW;
      const y = (ty[k]! + oy) * cellH;
      // orientation: flowing angle -> horizontal as the letter forms
      const ang = 0.95 * Math.sin(fx[k]! * 4.6 + t * 0.35 + phase[k]!) * inv;
      const hl = halfBase * (1 - 0.45 * m);
      const hx = Math.cos(ang) * hl;
      const hy = Math.sin(ang) * hl;
      ctx.moveTo(x - hx, y - hy);
      ctx.lineTo(x + hx, y + hy);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawTextLayer(): void {
    const ctx = this.ctx;
    const layout = this.layout;
    if (!ctx || !layout) return;
    const start = NET_START;
    const end = NET_END;
    let alpha = end > start ? smoothstep(clamp01((this.time - start) / (end - start))) : 0;
    if (alpha <= 0.004) return;

    if (this.time > MICRO_START) {
      alpha = Math.min(1, alpha * (1 + BREATH_VAR * Math.sin(this.time * 0.5)));
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = CRISP_TEXT;
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
    ctx.fillStyle = this.bgGrad ?? BG_TOP;
    ctx.fillRect(0, 0, this.pw, this.ph);
    ctx.fillStyle = this.haloGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
    this.drawStructure();
    this.drawTextLayer();
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
  }

  /** Static, fully-formed composition (reduced motion / pause). */
  private renderStatic(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    this.time = NET_END + 1;
    ctx.fillStyle = this.bgGrad ?? BG_TOP;
    ctx.fillRect(0, 0, this.pw, this.ph);
    ctx.fillStyle = this.haloGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
    this.drawTextLayer();
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
  }
}

export const morphTextAnimation: VersoAnimationDefinition = {
  id: "morph_text",
  create: () => new MorphTextScene(),
};
