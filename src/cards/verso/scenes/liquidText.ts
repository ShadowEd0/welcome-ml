import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

// ---------------------------------------------------------------------------
// "Liquide Précieux" (liquid_text) — the message is made of a precious liquid
// matter (molten amber) that gathers into the letters.
//
// Distinct identity vs ink_text (scattered ink fog on light paper): here,
// glowing amber droplets appear in a diffuse halo around the composition
// (Phase 1), then each droplet FLOWS toward its letter cell with a soft
// liquid overshoot (Phase 2, easeOutBack), the matter solidifies into crisp
// golden letters (Phase 3), and a slow specular highlight + gentle shimmer
// keep the surface barely alive (Phase 4).
//
// Rendering strategy (cheap + readable), same proven grid approach as
// ink_text: the message is laid out once, sampled into a low-res grid of
// letter cells; only "wet" cells are simulated (precomputed buffers, zero
// allocation per frame). A crisp gold text layer guarantees durable
// legibility once formed.
//
// Lifecycle: one RAF while active, none while inactive, a static composition
// under reduced motion, complete cleanup on destroy. No pointer interaction.
// ---------------------------------------------------------------------------

// ---- palette (molten amber on deep warm dark) ----
const BG_TOP = "#1a1410";
const BG_MID = "#110c08";
const BG_DEEP = "#070503";
const HALO_IN = "rgba(226, 168, 66, 0.11)";
const HALO_OUT = "rgba(226, 168, 66, 0)";
const VIGNETTE = "rgba(0, 0, 0, 0.30)";
// liquid body: deep -> mid, plus specular highlight
const LIQ_DEEP_R = 122; const LIQ_DEEP_G = 74;  const LIQ_DEEP_B = 26;
const LIQ_MID_R = 209;  const LIQ_MID_G = 148;  const LIQ_MID_B = 52;
const SPEC_R = 255;     const SPEC_G = 243;    const SPEC_B = 208;
const CRISP_TEXT = "#f4d07c";

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
const APPEAR_SPREAD = 0.8;   // droplets start appearing between 0 and this
const APPEAR_FADE = 0.45;    // droplet fade-in duration at its source
const TRAVEL_GAP = 0.5;      // after appearing, droplet waits before flowing
const TRAVEL_SPREAD = 1.3;   // stagger of the flow start times
const TRAVEL_MIN = 0.9;      // flow duration range (liquid, unhurried)
const TRAVEL_MAX = 1.4;
const NET_START = 2.6;       // crisp text layer starts to solidify
const NET_END = 3.6;
const MICRO_START = 3.8;     // micro-life begins
const SWEEP_END = 3.8;       // the first specular sweep finishes here
const SHIMMER_VAR = 0.05;    // ±5% surface shimmer after stabilisation

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Liquid flow easing: smooth approach with a soft overshoot then settle. */
function easeOutBack(p: number): number {
  const c1 = 1.3;
  const c3 = c1 + 1;
  const q = p - 1;
  return 1 + c3 * q * q * q + c1 * q * q;
}

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

/** Slow organic field in [-1, 1] used for the surface shimmer. */
function microField(fx: number, fy: number, t: number): number {
  return (
    Math.sin(fx * Math.PI * 2 * 2.2 + t * 0.45) +
    Math.sin(fy * Math.PI * 2 * 1.8 + t * 0.38) +
    Math.sin((fx + fy) * Math.PI * 2 * 2.6 + t * 0.30)
  ) / 3;
}

interface LiquidTextLayout {
  font: number;
  lineHeight: number;
  lines: string[];
  blockH: number;
  top: number;
}

class LiquidTextScene implements VersoScene {
  readonly id = "liquid_text";

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
  private layout: LiquidTextLayout | null = null;

  private bgGrad: CanvasGradient | null = null;
  private haloGrad: CanvasGradient | null = null;
  private vigGrad: CanvasGradient | null = null;

  // wet-cell simulation buffers (letter cells only, no per-frame allocation)
  private wetCount = 0;
  private tx: Float32Array | null = null;   // target position (grid units)
  private ty: Float32Array | null = null;
  private sx: Float32Array | null = null;   // source position (halo)
  private sy: Float32Array | null = null;
  private appear: Float32Array | null = null; // appearance start time
  private travel: Float32Array | null = null; // flow start time
  private dur: Float32Array | null = null;    // flow duration
  private heat: Float32Array | null = null;   // per-cell base brightness 0..1

  private target: Uint8Array | null = null;
  private maskCanvas: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;

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
    this.renderMaskToGrid();
    this.initDrops();
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
    this.sx = null;
    this.sy = null;
    this.appear = null;
    this.travel = null;
    this.dur = null;
    this.heat = null;
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

  private computeLayout(w: number, h: number): LiquidTextLayout | null {
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
   * Builds the wet-cell buffers: every letter cell gets a source position on
   * a diffuse halo around the text block, a staggered appearance time and a
   * liquid flow duration. Deterministic (same layout -> same choreography).
   */
  private initDrops(): void {
    const target = this.target;
    if (!target) return;
    const gw = this.gw;
    const gh = this.gh;
    const n = gw * gh;

    // count letter cells first, then fill fixed-size buffers
    let count = 0;
    for (let i = 0; i < n; i++) if (target[i] === 1) count++;
    this.wetCount = count;
    if (count === 0) return;

    if (!this.tx || this.tx.length !== count) {
      this.tx = new Float32Array(count);
      this.ty = new Float32Array(count);
      this.sx = new Float32Array(count);
      this.sy = new Float32Array(count);
      this.appear = new Float32Array(count);
      this.travel = new Float32Array(count);
      this.dur = new Float32Array(count);
      this.heat = new Float32Array(count);
    }

    const rng = mulberry32(4213);
    const cx = gw / 2;
    const cy = gh / 2;
    const haloRx = gw * 0.46;
    const haloRy = gh * 0.46;
    let k = 0;
    for (let i = 0; i < n; i++) {
      if (target[i] !== 1) continue;
      const gx = (i % gw) + 0.5;
      const gy = Math.floor(i / gw) + 0.5;

      // direction from block centre, source pushed onto a diffuse halo ring
      let dx = gx - cx;
      let dy = gy - cy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const ring = 0.55 + rng() * 0.45; // diffuse, not a perfect circle
      this.sx![k] = cx + dx * haloRx * ring + (rng() - 0.5) * gw * 0.08;
      this.sy![k] = cy + dy * haloRy * ring + (rng() - 0.5) * gh * 0.08;
      this.tx![k] = gx;
      this.ty![k] = gy;

      const a = rng() * APPEAR_SPREAD;
      this.appear![k] = a;
      this.travel![k] = a + TRAVEL_GAP + rng() * TRAVEL_SPREAD;
      this.dur![k] = TRAVEL_MIN + rng() * (TRAVEL_MAX - TRAVEL_MIN);
      this.heat![k] = rng();
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

  /** Position of the specular highlight along the text axis, in grid units. */
  private specularPos(t: number): number {
    if (t < SWEEP_END) {
      // one gentle sweep across the composition while the matter gathers
      return (-0.18 + 1.36 * smoothstep(clamp01(t / SWEEP_END))) * this.gw;
    }
    // afterwards: a barely-there drift around the centre
    return (0.5 + 0.085 * Math.sin((t - SWEEP_END) * 0.21)) * this.gw;
  }

  private drawLiquid(): void {
    const ctx = this.ctx;
    const tx = this.tx;
    const ty = this.ty;
    const sx = this.sx;
    const sy = this.sy;
    const appear = this.appear;
    const travel = this.travel;
    const dur = this.dur;
    const heat = this.heat;
    if (!ctx || !tx || !ty || !sx || !sy || !appear || !travel || !dur || !heat) return;
    if (this.wetCount === 0 || this.gw === 0) return;

    const t = this.time;
    const shimmer = t > MICRO_START;
    const specX = this.specularPos(t);
    const specSigma = Math.max(2.5, this.gw * 0.07);
    const invTwoSigma2 = 1 / (2 * specSigma * specSigma);
    const cellW = this.pw / this.gw;  // CSS px per grid cell
    const cellH = this.ph / this.gh;

    for (let k = 0; k < this.wetCount; k++) {
      // appearance: fade in at the source position
      const a = clamp01((t - appear[k]!) / APPEAR_FADE);
      if (a <= 0.004) continue;
      let alpha = smoothstep(a);

      // liquid flow toward the letter cell (soft overshoot then settle)
      const tp = clamp01((t - travel[k]!) / dur[k]!);
      const e = easeOutBack(tp);
      const x = sx[k]! + (tx[k]! - sx[k]!) * e;
      const y = sy[k]! + (ty[k]! - sy[k]!) * e;

      // settled drops carry the full body; travelling drops stay lighter
      const settled = tp >= 1;
      let body = settled ? 1 : 0.62 + 0.38 * tp;
      if (settled && shimmer) {
        const fx = tx[k]! / this.gw;
        const fy = ty[k]! / this.gh;
        body *= 1 + SHIMMER_VAR * microField(fx, fy, t);
      }
      alpha *= Math.min(1, body);

      // brightness: deep amber while travelling, molten gold when settled
      const h = heat[k]!;
      const mix = settled ? 0.55 + 0.45 * h : 0.25;
      let r = LIQ_DEEP_R + (LIQ_MID_R - LIQ_DEEP_R) * mix;
      let g = LIQ_DEEP_G + (LIQ_MID_G - LIQ_DEEP_G) * mix;
      let b = LIQ_DEEP_B + (LIQ_MID_B - LIQ_DEEP_B) * mix;

      // specular highlight: cells near the moving band catch the light
      const bandDist = x + 0.35 * y - specX - 0.35 * this.gh * 0.5;
      const spec = Math.exp(-bandDist * bandDist * invTwoSigma2);
      if (spec > 0.02) {
        r += (SPEC_R - r) * spec * 0.85;
        g += (SPEC_G - g) * spec * 0.85;
        b += (SPEC_B - b) * spec * 0.85;
      }

      // droplets compress slightly as they settle (liquid feel)
      const rad = cellW * (settled ? 0.62 : 0.74);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgb(${r | 0}, ${g | 0}, ${b | 0})`;
      ctx.beginPath();
      ctx.arc(x * cellW, y * cellH, rad, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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
      alpha = Math.min(1, alpha * (1 + 0.015 * Math.sin(this.time * 0.55)));
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
    this.drawLiquid();
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
    this.drawLiquid();
    this.drawTextLayer();
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
  }
}

export const liquidTextAnimation: VersoAnimationDefinition = {
  id: "liquid_text",
  create: () => new LiquidTextScene(),
};
