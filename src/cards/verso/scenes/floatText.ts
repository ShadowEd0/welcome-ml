import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

// ---------------------------------------------------------------------------
// "Légèreté" (float_text) — the letters have an almost physical lightness.
// They gently drift into their places (assemble), settle, then float with a
// barely visible per-character motion. The phrase always reads as ONE
// composition: the movement is extremely controlled (sub-pixel, slow).
//
// Canvas 2D. Per-contact glyph data is built once at layout/resize time.
// Each glyph: target position (from the measured layout), a random start
// delay, a spawn offset and an ease-out-back motion that overshoots once —
// the letter "settles" like a mote of dust. After t ≈ 2.8 s a micro-float:
// ±~1 px position and ~1° rotation drift on slow per-letter phases.
//
// Lifecycle: one RAF while active, none while inactive, static composition
// under reduced motion, complete cleanup on destroy.
// ---------------------------------------------------------------------------

// ---- palette (deep blue-slate night, soft pearl letters) ----
const BG_TOP = "#141b33";
const BG_MID = "#0d1424";
const BG_DEEP = "#070a14";
const VIGNETTE_MID = "rgba(10, 14, 28, 0.06)";
const VIGNETTE_EDGE = "rgba(5, 7, 16, 0.34)";
const INK_MAIN = "rgba(232, 230, 244, 1)";
const INK_AIR = "rgba(196, 208, 232, 1)";

// ---- typography ----
const FONT_FAMILY = "\"Cormorant Garamond\", Georgia, serif";
const LINE_HEIGHT_FACTOR = 1.26;
const BASELINE_FACTOR = 0.86;
const DPR_MAX = 2;

// ---- timing (seconds) ----
const SPAWN_SPREAD = 1.2; // per-glyph starting delay window
const SETTLE_SECONDS = 1.15; // glyph motion duration once it starts
const FLOAT_START = 2.8; // micro-float begins
const FLOAT_POS = 0.016; // fraction of font px for position drift
const FLOAT_ROT = 0.018; // radians

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Deterministic PRNG so a given message floats the same way every mount. */
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

/** Overshooting settle: 0..1 with a soft tip-over past the target. */
function settleCurve(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const s = smoothstep(u);
  return s + (1 - s) * Math.sin(u * Math.PI) * 0.18;
}

interface FloatLayout {
  font: number; // CSS px
  lineHeight: number; // CSS px
  lines: string[];
  lineWidths: number[]; // CSS px per line
  baselines: number[]; // CSS px per line
  blockH: number; // CSS px
}

interface FloatGlyph {
  ch: string;
  tx: number; // target x (CSS px)
  ty: number; // target baseline (CSS px)
  start: number; // seconds
  sx: number; // spawn offset x (CSS px)
  sy: number; // spawn offset y (CSS px)
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  rotFreq: number;
  rotPhase: number;
  opacity: number; // tiny per-glyph static variance
}

class FloatTextScene implements VersoScene {
  readonly id = "float_text";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private reduced = false;
  private destroyed = false;

  private pw = 0;
  private ph = 0;

  private message = "";
  private layout: FloatLayout | null = null;
  private glyphs: FloatGlyph[] = [];
  private glyphSeed = 1;

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
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.layout = this.computeLayout(w, h);
    this.buildGlyphs();
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
    this.canvas = null;
    this.ctx = null;
    this.glyphs = [];
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

  private computeLayout(w: number, h: number): FloatLayout | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const availW = w * 0.84;
    const availH = h * 0.56;
    if (availW < 24 || availH < 24) return null;

    const words = this.message.split(/\s+/).filter((s) => s.length > 0);
    if (words.length === 0) return null;

    let font = Math.max(14, Math.min(availW * 0.48, availH * 0.3));
    let lines: string[] = [];
    let lineWidths: number[] = [];
    let blockH = font;

    for (let guard = 0; guard < 40; guard++) {
      ctx.font = `${this.round1(font)}px ${FONT_FAMILY}`;
      lines = this.wrapWords(words, availW);
      const lineHeight = font * LINE_HEIGHT_FACTOR;
      blockH = lines.length * lineHeight;
      lineWidths = lines.map((ln) => ctx.measureText(ln).width);
      const maxW = Math.max(...lineWidths);
      if (maxW <= availW && blockH <= availH) {
        break;
      }
      const scale = Math.max(0.55, Math.min(availW / (maxW || 1), availH / (blockH || 1), 0.92));
      font *= scale;
    }
    const lineHeight = font * LINE_HEIGHT_FACTOR;
    const top = (h - blockH) * 0.5;
    const baselines = lines.map((_, i) => top + i * lineHeight + font * BASELINE_FACTOR);
    return { font, lineHeight, lines, lineWidths, baselines, blockH };
  }
// ---- glyphs --------------------------------------------------------------

  private buildGlyphs(): void {
    const ctx = this.ctx;
    const layout = this.layout;
    if (!ctx || !layout) {
      this.glyphs = [];
      return;
    }
    ctx.font = `${this.round1(layout.font)}px ${FONT_FAMILY}`;
    const rand = mulberry32(this.glyphSeed /* deterministic per message mount */);
    const glyphs: FloatGlyph[] = [];
    const spawnR = Math.min(this.pw, this.ph) * 0.16;

    for (let li = 0; li < layout.lines.length; li++) {
      const line = layout.lines[li];
      const baseline = layout.baselines[li];
      const lineW = layout.lineWidths[li];
      const x0 = this.pw / 2 - lineW * 0.5;
      let cursor = 0;
      for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        if (ch === " ") {
          cursor += ctx.measureText(" ").width;
          continue;
        }
        const wChar = ctx.measureText(ch).width;
        const angle = rand() * Math.PI * 2;
        const radius = (0.25 + rand() * 0.75) * spawnR;
        glyphs.push({
          ch,
          tx: x0 + cursor + wChar * 0.5,
          ty: baseline,
          start: rand() * SPAWN_SPREAD,
          sx: Math.cos(angle) * radius,
          sy: Math.sin(angle) * radius,
          freqX: 0.55 + rand() * 0.9,
          freqY: 0.5 + rand() * 0.85,
          phaseX: rand() * Math.PI * 2,
          phaseY: rand() * Math.PI * 2,
          rotFreq: 0.4 + rand() * 0.7,
          rotPhase: rand() * Math.PI * 2,
          opacity: 0.92 + rand() * 0.08,
        });
        cursor += wChar;
      }
    }
    this.glyphs = glyphs;
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
    vig.addColorStop(0, "rgba(12, 16, 30, 0)");
    vig.addColorStop(0.55, VIGNETTE_MID);
    vig.addColorStop(1, VIGNETTE_EDGE);
    this.bgGrad = bg;
    this.vigGrad = vig;
  }
// ---- rendering ----------------------------------------------------------

  private drawGlyph(glyph: FloatGlyph, u: number, t: number): void {
    const ctx = this.ctx;
    const font = this.layout?.font ?? 16;
    if (!ctx || u <= 0) return;

    const settle = settleCurve(u);
    // assemble from the spawn offset toward the target with a soft overshoot
    const gx = glyph.tx + (1 - settle) * glyph.sx + glyph.sy * 0.12 * (1 - settle);
    const gy = glyph.ty + (1 - settle) * glyph.sy - glyph.sx * 0.12 * (1 - settle);

    // micro-float once the composition is assembled
    let fx = 0;
    let fy = 0;
    let rot = 0;
    if (t > FLOAT_START) {
      const ft = t - FLOAT_START;
      fx = Math.sin(ft * glyph.freqX + glyph.phaseX) * font * FLOAT_POS;
      fy = Math.sin(ft * glyph.freqY + glyph.phaseY) * font * FLOAT_POS;
      rot = Math.sin(t * glyph.rotFreq + glyph.rotPhase) * FLOAT_ROT;
    }

    ctx.save();
    ctx.translate(gx + fx, gy + fy);
    ctx.rotate(rot);
    ctx.globalAlpha = glyph.opacity * Math.min(1, settle * 1.6);
    ctx.fillStyle = INK_MAIN;
    ctx.font = `${this.round1(font)}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(glyph.ch, 0, 0);
    ctx.restore();

    // a whisper of a secondary air letter behind the main one (depth)
    if (rot !== 0 || t < FLOAT_START + 0.6) {
      ctx.save();
      ctx.translate(gx + fx * 1.6, gy + fy * 1.6);
      ctx.rotate(rot * 0.6);
      ctx.globalAlpha = 0.06 * settle;
      ctx.fillStyle = INK_AIR;
      ctx.font = `${this.round1(font)}px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(glyph.ch, 0, 0);
      ctx.restore();
    }
  }

  private paintBackdrop(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    ctx.fillStyle = this.bgGrad ?? BG_MID;
    ctx.fillRect(0, 0, this.pw, this.ph);
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
  }

  private renderFrame(): void {
    const ctx = this.ctx;
    if (!ctx || this.layout === null || this.glyphs.length === 0 || this.pw === 0) return;
    const t = this.time;
    this.paintBackdrop();
    for (const glyph of this.glyphs) {
      const u = clamp01((t - glyph.start) / SETTLE_SECONDS);
      this.drawGlyph(glyph, u, t);
    }
  }

  /** Static, fully-formed composition (reduced motion / pause). */
  private renderStatic(): void {
    const ctx = this.ctx;
    const layout = this.layout;
    if (!ctx || !layout || this.pw === 0) return;
    this.time = FLOAT_START + 0.5;
    this.paintBackdrop();
    ctx.font = `${this.round1(layout.font)}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (let li = 0; li < layout.lines.length; li++) {
      ctx.fillStyle = INK_MAIN;
      ctx.globalAlpha = 1;
      ctx.fillText(layout.lines[li], this.pw / 2, layout.baselines[li]);
    }
    ctx.globalAlpha = 1;
  }
}

export const floatTextAnimation: VersoAnimationDefinition = {
  id: "float_text",
  create: () => new FloatTextScene(),
};