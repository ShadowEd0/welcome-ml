import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

// ---------------------------------------------------------------------------
// "Révélation" (reveal_text) — the message is discovered progressively by a
// light that TRAVERSES the composition. Distinct from light_text: no
// letter-drawing filament — here a large soft band of light (a "travelling
// curtain" luminance) sweeps across the whole text block. Under the band the
// text glows at full warmth; outside it stays as a dim ghost of itself.
// Once the sweep is over the whole message stays bright: discovery complete.
//
// Canvas 2D. A bright-text offscreen buffer is rendered once at layout time.
// Every frame the band position is eased across the width; the bright buffer
// is composited with a soft trapezoid alpha profile (clip passes), plus a
// subtle warm leading edge. After t ≈ 3.1 s a barely perceptible luminance
// breath remains. Reduced-motion → static fully-bright composition.
// ---------------------------------------------------------------------------

// ---- palette (deep teal night, warm light) ----
const BG_TOP = "#111d2c";
const BG_MID = "#0b1522";
const BG_DEEP = "#060c14";
const VIGNETTE_MID = "rgba(8, 13, 24, 0.06)";
const VIGNETTE_EDGE = "rgba(4, 8, 14, 0.34)";
const DIM_TEXT = "rgba(122, 132, 148, 0.45)"; // ghost outside the band
const BRIGHT_TEXT = "rgba(247, 232, 196, 1)"; // lit ink
const EDGE_CORE = "rgba(255, 240, 200, 0.55)";
const EDGE_MID = "rgba(236, 190, 110, 0.16)";
const EDGE_RIM = "rgba(236, 190, 110, 0)";

// ---- typography ----
const FONT_FAMILY = "\"Cormorant Garamond\", Georgia, serif";
const LINE_HEIGHT_FACTOR = 1.26;
const BASELINE_FACTOR = 0.86;
const DPR_MAX = 2;

// ---- timing (seconds) ----
const SWEEP_START = 0.5; // the light band begins to move
const SWEEP_DUR = 2.0; // how long the first traversal takes
const BRIGHTEN_START = 2.55; // the whole block brightens (discovery complete)
const BRIGHTEN_END = 3.15;
const BREATH_START = 3.3; // micro-luminance breath
const BREATH_AMP = 0.018; // ±1.8 % global brightness

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

// width of the bright band relative to the block width + soft edges
const BAND_W = 0.5;
const BAND_PASSES: readonly (readonly [number, number])[] = [
  [0.55, 0.26], // [alpha, halfWidth fraction of band]
  [0.8, 0.14],
  [0.98, 0.06],
  [1, 0.02],
];

interface RevealLayout {
  font: number; // CSS px
  lines: string[];
  baselines: number[]; // CSS px
  blockH: number; // CSS px
}

class RevealTextScene implements VersoScene {
  readonly id = "reveal_text";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private reduced = false;
  private destroyed = false;

  private pw = 0;
  private ph = 0;
  private dpr = 1;

  private message = "";
  private layout: RevealLayout | null = null;

  // offscreen canvas holding the bright text, baked at layout time
  private bright: HTMLCanvasElement | null = null;
  private brightCtx: CanvasRenderingContext2D | null = null;

  private bgGrad: CanvasGradient | null = null;
  private vigGrad: CanvasGradient | null = null;

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
    this.dpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.layout = this.computeLayout(w, h);
    this.buildBright();
    this.buildBackground();

    if (this.reduced) this.renderStatic();
    else this.renderFrame();
  }
// ---- lifecycle ----------------------------------------------------------

  setActive(active: boolean): void {
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
    } else if (this.rafId === null) {
      this.time = 0;
      this.lastTime = performance.now() / 1000;
      if (this.canvas) this.rafId = requestAnimationFrame(this.frame);
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.canvas?.remove();
    this.bright?.remove();
    this.canvas = null;
    this.ctx = null;
    this.bright = null;
    this.brightCtx = null;
    this.layout = null;
    this.bgGrad = null;
    this.vigGrad = null;
    this.host = null;
  }

  // ---- animation ----------------------------------------------------------

  private frame = (now: number): void => {
    if (this.destroyed) {
      this.rafId = null;
      return;
    }
    if (this.reduced) {
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

  private round1(v: number): number {
    return Math.max(1, Math.round(v * 10) / 10);
  }

  private wrapWords(words: readonly string[], maxW: number): string[] {
    const ctx = this.ctx;
    if (!ctx) return [];
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

  private computeLayout(w: number, h: number): RevealLayout | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const availW = w * 0.84;
    const availH = h * 0.56;
    if (availW < 24 || availH < 24) return null;

    const words = this.message.split(/\s+/).filter((s) => s.length > 0);
    if (words.length === 0) return null;

    let font = Math.max(14, Math.min(availW * 0.48, availH * 0.3));
    let lines: string[] = [];
    let blockH = font;

    for (let guard = 0; guard < 40; guard++) {
      ctx.font = `${this.round1(font)}px ${FONT_FAMILY}`;
      lines = this.wrapWords(words, availW);
      const lineHeight = font * LINE_HEIGHT_FACTOR;
      blockH = lines.length * lineHeight;
      let maxW = 0;
      for (const line of lines) {
        const lw = ctx.measureText(line).width;
        if (lw > maxW) maxW = lw;
      }
      if (maxW <= availW && blockH <= availH) break;
      const scale = Math.max(0.55, Math.min(availW / (maxW || 1), availH / (blockH || 1), 0.92));
      font *= scale;
    }
    const lineHeight = font * LINE_HEIGHT_FACTOR;
    const top = (h - blockH) * 0.5;
    const baselines = lines.map((_, i) => top + i * lineHeight + font * BASELINE_FACTOR);
    return { font, lines, baselines, blockH };
  }
// ---- buffers -------------------------------------------------------------

  private buildBright(): void {
    const layout = this.layout;
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!layout || !canvas || !ctx) return;
    if (!this.bright) {
      const b = document.createElement("canvas");
      this.bright = b;
      this.brightCtx = b.getContext("2d");
    }
    const b = this.bright;
    const bctx = this.brightCtx;
    if (!b || !bctx) return;
    b.width = canvas.width;
    b.height = canvas.height;
    bctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    bctx.clearRect(0, 0, this.pw, this.ph);
    bctx.fillStyle = BRIGHT_TEXT;
    bctx.font = `${this.round1(layout.font)}px ${FONT_FAMILY}`;
    bctx.textAlign = "center";
    bctx.textBaseline = "alphabetic";
    for (let i = 0; i < layout.lines.length; i++) {
      bctx.fillText(layout.lines[i], this.pw / 2, layout.baselines[i]);
    }
  }

  private buildBackground(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0 || this.ph === 0) return;
    const bg = ctx.createLinearGradient(0, 0, 0, this.ph);
    bg.addColorStop(0, BG_TOP);
    bg.addColorStop(0.55, BG_MID);
    bg.addColorStop(1, BG_DEEP);
    const vig = ctx.createRadialGradient(
      this.pw / 2, this.ph / 2, Math.min(this.pw, this.ph) * 0.34,
      this.pw / 2, this.ph / 2, Math.max(this.pw, this.ph) * 0.72
    );
    vig.addColorStop(0, "rgba(8, 13, 24, 0)");
    vig.addColorStop(0.55, VIGNETTE_MID);
    vig.addColorStop(1, VIGNETTE_EDGE);
    this.bgGrad = bg;
    this.vigGrad = vig;
  }

  // ---- rendering ----------------------------------------------------------

  private paintBackdrop(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    ctx.fillStyle = this.bgGrad ?? BG_MID;
    ctx.fillRect(0, 0, this.pw, this.ph);
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
  }

  private drawDimGhost(): void {
    const ctx = this.ctx;
    const layout = this.layout;
    if (!ctx || !layout) return;
    ctx.save();
    ctx.fillStyle = DIM_TEXT;
    ctx.font = `${this.round1(layout.font)}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < layout.lines.length; i++) {
      ctx.fillText(layout.lines[i], this.pw / 2, layout.baselines[i]);
    }
    ctx.restore();
  }

  /** Composites the bright text masked by a soft band centered at `cx`. */
  private drawBandMasked(cx: number, bandW: number): void {
    const ctx = this.ctx;
    const b = this.bright;
    if (!ctx || !b || this.pw === 0) return;
    for (const [alpha, half] of BAND_PASSES) {
      const halfW = bandW * half;
      if (halfW <= 0.5) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - halfW, 0, halfW * 2, this.ph);
      ctx.clip();
      ctx.globalAlpha = alpha;
      ctx.drawImage(b, 0, 0, this.pw, this.ph, 0, 0, this.pw, this.ph);
      ctx.restore();
    }
  }

  private drawLeadingEdge(cx: number, bandW: number): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    const r = bandW * 0.55;
    const g = ctx.createRadialGradient(cx, this.ph / 2, 0, cx, this.ph / 2, r);
    g.addColorStop(0, EDGE_CORE);
    g.addColorStop(0.5, EDGE_MID);
    g.addColorStop(1, EDGE_RIM);
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.rect(cx - r, 0, r * 2, this.ph);
    ctx.fill();
    ctx.restore();
  }

  private renderFrame(): void {
    const ctx = this.ctx;
    const layout = this.layout;
    if (!ctx || !layout || this.pw === 0) return;
    const t = this.time;

    this.paintBackdrop();
    this.drawDimGhost();

    // the band travels once across the whole composition, easing out
    const u = smoothstep(clamp01((t - SWEEP_START) / SWEEP_DUR));
    const cx = -this.pw * 0.2 + u * (this.pw * 1.4);
    const bandW = Math.max(this.pw, this.ph) * BAND_W * 0.5;

    this.drawBandMasked(cx, bandW);
    this.drawLeadingEdge(cx, bandW);

    // after the traversal the whole block brightens to full
    const whole = smoothstep(clamp01((t - BRIGHTEN_START) / (BRIGHTEN_END - BRIGHTEN_START)));
    if (whole > 0) {
      let a = whole;
      if (t > BREATH_START) a *= 1 + BREATH_AMP * Math.sin(t * 0.5);
      const bright = this.bright;
      if (bright) {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.drawImage(bright, 0, 0, this.pw, this.ph, 0, 0, this.pw, this.ph);
        ctx.restore();
      }
    }
  }

  /** Static, fully-formed bright composition (reduced motion / pause). */
  private renderStatic(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    this.time = BRIGHTEN_END + 0.5;
    this.paintBackdrop();
    const bright = this.bright;
    if (bright) ctx.drawImage(bright, 0, 0, this.pw, this.ph, 0, 0, this.pw, this.ph);
  }
}

export const revealTextAnimation: VersoAnimationDefinition = {
  id: "reveal_text",
  create: () => new RevealTextScene(),
};