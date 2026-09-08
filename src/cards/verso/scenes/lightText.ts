import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

// ---------------------------------------------------------------------------
// "Filament de Lumière" — a text verso where a fine luminous presence reveals
// the message: a delicate filament of light draws the letters before settling.
//
// Rendering strategy (cheap + readable):
//   - the message is laid out once (wrapping + auto-fit) in CSS units;
//   - each line carries a "reveal" window in time; a bright filament travels
//     along the line while a soft light-front uncovers the ink left to right,
//     so the light genuinely *draws* the text instead of a sliding CSS mask;
//   - before its front a line is a faint ghost, at the front a warm halo,
//     after the front the line reads at full contrast — never a neon cliché;
//   - once every line is revealed the filament fades, the halo settles and a
//     barely perceptible luminous breath remains (Phase 4);
//   - on a deep indigo backdrop (same warm atelier register as light_tailor).
//
// Lifecycle: one RAF while active, none while inactive, a static composition
// under reduced motion, complete cleanup on destroy. No pointer interaction:
// the reading of the text takes precedence over an optional hover.
// ---------------------------------------------------------------------------

// ---- palette (warm light on deep indigo) ----
const BG_TOP = "#161126";
const BG_MID = "#0e0a19";
const BG_DEEP = "#07060c";
const VIGNETTE_MID = "rgba(16, 12, 28, 0.06)";
const VIGNETTE_EDGE = "rgba(8, 6, 14, 0.34)";
const INK_LIGHT = "rgba(244, 226, 184, 1)"; // revealed text ink
const FILAMENT_CORE = "rgba(255, 245, 214, 1)";
const FILAMENT_MID = "rgba(235, 196, 128, 0.30)";
const FILAMENT_RIM = "rgba(235, 196, 128, 0)";

// ---- typography ----
const FONT_FAMILY = "\"Cormorant Garamond\", Georgia, serif";
const LINE_HEIGHT_FACTOR = 1.24;
const BASELINE_FACTOR = 0.86;
const DPR_MAX = 2;

// ---- timing (seconds) ----
const PHANTOM_END = 1.1; // the ghost materialises softly
const REVEAL_SPEED = 0.9; // seconds per line of reveal
const REVEAL_GAP = 0.16; // pause between the end of a line and the next
const FILAMENT_END = 3.4; // filament + halo fully gone by then
const MICRO_START = 3.6; // luminous breath begins
const BREATH_AMP = 0.022; // ±2.2 % text intensity breathing
const HALO_AMP = 0.018; // ±1.8 % soft halo breathing

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

interface LightTextLayout {
  font: number; // CSS px
  lineHeight: number; // CSS px
  lines: string[];
  widths: number[]; // measured width per line, CSS px
  baselines: number[]; // y baseline per line, CSS px
  blockH: number; // CSS px
  startTime: number[]; // reveal window start per line
  endTime: number[]; // reveal window end per line
}

class LightTextScene implements VersoScene {
  readonly id = "light_text";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private active = false;
  private reduced = false;
  private destroyed = false;

  private pw = 0;
  private ph = 0;

  private message = "";
  private layout: LightTextLayout | null = null;

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
    this.canvas = null;
    this.ctx = null;
    this.bgGrad = null;
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

  private computeLayout(w: number, h: number): LightTextLayout | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const availW = w * 0.82;
    const availH = h * 0.56;
    if (availW < 24 || availH < 24) return null;

    const words = this.message.split(/\s+/).filter((s) => s.length > 0);
    if (words.length === 0) return null;

    let font = Math.max(14, Math.min(availW * 0.48, availH * 0.3));
    let lines: string[] = [];
    let widths: number[] = [];
    let blockH = font;

    for (let guard = 0; guard < 40; guard++) {
      ctx.font = `${this.round1(font)}px ${FONT_FAMILY}`;
      lines = this.wrapWords(words, availW);
      const lineHeight = font * LINE_HEIGHT_FACTOR;
      blockH = lines.length * lineHeight;
      widths = lines.map((ln) => ctx.measureText(ln).width);
      const maxW = Math.max(...widths);
      if (maxW <= availW && blockH <= availH) {
        return this.finalize(w, h, font, lineHeight, lines, widths, blockH);
      }
      const scale = Math.max(0.55, Math.min(availW / (maxW || 1), availH / (blockH || 1), 0.92));
      font *= scale;
    }
    const lineHeight = font * LINE_HEIGHT_FACTOR;
    blockH = lines.length * lineHeight;
    widths = lines.map((ln) => ctx.measureText(ln).width);
    return this.finalize(w, h, font, lineHeight, lines, widths, blockH);
  }

  private finalize(
    w: number,
    h: number,
    font: number,
    lineHeight: number,
    lines: string[],
    widths: number[],
    blockH: number
  ): LightTextLayout {
    const top = (h - blockH) * 0.5;
    const baselines = lines.map((_, i) => top + i * lineHeight + font * BASELINE_FACTOR);
    const startTime: number[] = [];
    const endTime: number[] = [];
    let t = PHANTOM_END;
    for (let i = 0; i < lines.length; i++) {
      startTime[i] = t;
      const lineDur = REVEAL_SPEED * clamp01(0.4 + widths[i] / w);
      endTime[i] = t + lineDur;
      t = endTime[i] + REVEAL_GAP;
    }
    return { font, lineHeight, lines, widths, baselines, blockH, startTime, endTime };
  }

  // ---- background ---------------------------------------------------------

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
    vig.addColorStop(0, "rgba(20, 15, 34, 0)");
    vig.addColorStop(0.55, VIGNETTE_MID);
    vig.addColorStop(1, VIGNETTE_EDGE);
    this.bgGrad = bg;
    this.vigGrad = vig;
  }

  private paintBackdrop(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    ctx.fillStyle = this.bgGrad ?? BG_MID;
    ctx.fillRect(0, 0, this.pw, this.ph);
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
  }

  /** 0..1 how far `t` is between `a` and `b` (0 before, 1 after). */
  private window(t: number, a: number, b: number): number {
    if (b <= a) return t >= b ? 1 : 0;
    return clamp01((t - a) / (b - a));
  }

  // ---- rendering ----------------------------------------------------------

  private drawGhostLine(line: string, x: number, baseline: number, ghost: number): void {
    const ctx = this.ctx;
    if (!ctx || ghost <= 0.004) return;
    ctx.save();
    ctx.font = `${this.round1(this.layout!.font)}px ${FONT_FAMILY}`;
    ctx.globalAlpha = ghost;
    ctx.fillStyle = "rgba(196, 178, 150, 1)";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(line, x, baseline);
    ctx.restore();
  }

  private drawRevealedLine(line: string, x: number, baseline: number, xFront: number, front: number): void {
    const ctx = this.ctx;
    if (!ctx || front <= 0.004) return;
    ctx.save();
    ctx.font = `${this.round1(this.layout!.font)}px ${FONT_FAMILY}`;
    ctx.beginPath();
    ctx.rect(0, baseline - this.layout!.font * 1.05, xFront, this.layout!.font * 1.34);
    ctx.clip();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK_LIGHT;
    ctx.globalAlpha = 1;
    ctx.fillText(line, x, baseline);
    ctx.restore();
  }

  private drawFilament(x: number, baseline: number, strength: number, r: number): void {
    const ctx = this.ctx;
    if (!ctx || strength <= 0.01) return;
    const core = ctx.createRadialGradient(x, baseline, 0, x, baseline, r);
    core.addColorStop(0, FILAMENT_CORE);
    core.addColorStop(0.4, FILAMENT_MID);
    core.addColorStop(1, FILAMENT_RIM);
    ctx.save();
    ctx.globalAlpha = Math.min(1, strength);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, baseline, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderFrame(): void {
    const ctx = this.ctx;
    const layout = this.layout;
    if (!ctx || !layout || this.pw === 0) return;
    const t = this.time;

    this.paintBackdrop();

    const breath = t > MICRO_START
      ? 1 + BREATH_AMP * Math.sin(t * 0.62)
      : 1;

    let filamentX = -1;
    let filamentBaseline = 0;

    let revealEnd = 0;

    for (let i = 0; i < layout.lines.length; i++) {
      const line = layout.lines[i];
      const width = layout.widths[i];
      const x = this.pw / 2;
      const baseline = layout.baselines[i];
      const xLeft = x - width * 0.5;
      const front = this.window(t, layout.startTime[i], layout.endTime[i]);
      const xFront = xLeft + front * width;
      revealEnd = Math.max(revealEnd, layout.endTime[i]);

      // ghost: soft before the front, fading as the line solidifies
      const ghost = this.window(t, 0, PHANTOM_END + 0.3);
      const ghostPast = this.window(t, layout.startTime[i], layout.endTime[i] * 0.9);
      const echo = 0.12 * (1 - front);
      this.drawGhostLine(line, x, baseline, Math.max(0, ghost - smoothstep(ghostPast) + echo));

      this.drawRevealedLine(line, x, baseline, xFront, front * breath);

      if (front > 0.004 && front < 1) {
        filamentX = xFront;
        filamentBaseline = baseline;
      }
    }

    // filament halo cools down right after the last line is revealed
    const fade = 1 - smoothstep(this.window(t, revealEnd, Math.max(FILAMENT_END, revealEnd + 0.4)));
    if (filamentX >= 0 || (this.window(t, revealEnd, revealEnd + 0.6) > 0)) {
      // keep the tip glowing briefly at the last line's end even at front == 1
      if (filamentX < 0) {
        const last = layout.lines.length - 1;
        filamentX = this.pw / 2 + layout.widths[last] * 0.5;
        filamentBaseline = layout.baselines[last];
      }
      const r = Math.min(this.pw, this.ph) * 0.05;
      this.drawFilament(filamentX, filamentBaseline, fade, r);
    }

    // whole composition breathes very slightly
    if (t > revealEnd + 0.2 && t > MICRO_START) {
      const x = this.pw / 2;
      const y = this.ph / 2;
      const haloR = Math.max(this.pw, this.ph) * 0.5;
      const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
      const a = HALO_AMP * (0.5 + 0.5 * Math.sin(t * 0.42));
      halo.addColorStop(0, `rgba(235, 196, 128, ${a})`);
      halo.addColorStop(1, "rgba(235, 196, 128, 0)");
      ctx.save();
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, this.pw, this.ph);
      ctx.restore();
    }
  }

  /** Static, fully-formed composition (reduced motion / pause). */
  private renderStatic(): void {
    const ctx = this.ctx;
    const layout = this.layout;
    if (!ctx || !layout || this.pw === 0) return;
    this.time = FILAMENT_END + 0.5;
    this.paintBackdrop();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < layout.lines.length; i++) {
      ctx.fillStyle = INK_LIGHT;
      ctx.font = `${this.round1(layout.font)}px ${FONT_FAMILY}`;
      ctx.fillText(layout.lines[i], this.pw / 2, layout.baselines[i]);
    }
  }
}

export const lightTextAnimation: VersoAnimationDefinition = {
  id: "light_text",
  create: () => new LightTextScene(),
};