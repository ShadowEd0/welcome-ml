// ARCHIVÉ (Mission #18) : prototype retiré du registry actif — conservé ici
// pour référence. Non importé par scenes/index.ts, donc absent du bundle.
import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../../types";

// ---------------------------------------------------------------------------
// retable_miniature — a small precious architectural object that opens
// and reveals a miniature world far deeper than it should be.
//
// A hand-crafted little theatre-shrine stands in the dark: dark wood, ivory,
// very fine gold. It is closed. It wakes with a golden seam. Its two lateral
// panels (wings) swing open and expose a recess that first looks almost
// empty. Then a tiny distant light appears in the dark, and progressively
// reveals a whole miniature world: a night sky, a horizon, thin columns, a
// proscenium arch, a warm light source. The scene rises to an elegant climax,
// then calms and the panels close again — a short breath before the next
// cycle.
//
// It is never a literal illustration: the object is abstracted enough to
// suggest a reliquary, a theatre, a lamp, a "coffre à monde" — never a
// church. Depth is real: many planes, each drawn with its own parallax.
//
// Cycle (t in seconds, one pass = CYCLE_SECONDS):
//    0-14%  closed object (also the "breath" between cycles)
//   14-24%  the object wakes — a golden seam shimmers
//   24-38%  the panels open
//   40-50%  the interior seems almost empty (darkness)
//   50-60%  a small distant light appears
//   58-70%  the light grows and progressively reveals the planes
//   62-80%  the miniature world is fully visible
//   78-88%  climax — the light peaks (subtle, never a show)
//   86-94%  the world calms; the light declines
//   90-100% the panels close again
//
// Variation is deterministic per cycle. Pointer: a very light parallax that
// shifts each plane by a different amount (and, only slightly, the light and
// a few particles). No global listener; everything removed on destroy.
// Single RAF while active, none while inactive or reduced-motion.
// Reduced-motion: the open world at its climax, static and alive.
// ---------------------------------------------------------------------------

const CYCLE_SECONDS = 27;
const DPR_MAX = 2;
const TAU = Math.PI * 2;

// Geometry, as fractions of width (pw) and height (ph).
const FRAME_L = 0.27, FRAME_R = 0.73;
const FRAME_T = 0.15, FRAME_B = 0.86;
const ARCH_T = 0.1; // apex of the little gable above the frame
const INT_L = 0.315, INT_R = 0.685; // recess opening
const INT_T = 0.19, INT_B = 0.825;
const WING_W = FRAME_R - 0.5; // 0.23 pw
const WING_T = 0.15, WING_B = 0.845;
const PLINTH_L = 0.235, PLINTH_R = 0.765;
const PLINTH_T = 0.852, PLINTH_B = 0.912;
// the "world" recessed in the back, a vignette standing above the floor
const WORLD_L = 0.37, WORLD_R = 0.63;
const WORLD_T = 0.31, WORLD_B = 0.55;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const smooth = (a: number, b: number, x: number): number =>
  clamp01((x - a) / (b - a));
const smoothstep = (t: number): number => {
  const v = clamp01(t);
  return v * v * (3 - 2 * v);
};

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

interface RGB {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const css = (c: RGB, a: number): string =>
  `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`;

const GOLD = { r: 203, g: 166, b: 102 } as const;
const IVORY = { r: 238, g: 230, b: 212 } as const;
const NIGHT = { r: 13, g: 22, b: 38 } as const;
const NIGHT_B = { r: 32, g: 47, b: 72 } as const;
const NIGHT_D = { r: 16, g: 26, b: 44 } as const;
const WARM = { r: 255, g: 213, b: 150 } as const;
const WOOD_L = { r: 56, g: 42, b: 29 } as const;
const WOOD_M = { r: 36, g: 25, b: 16 } as const;
const WOOD_D = { r: 19, g: 12, b: 7 } as const;
const CHAMBER = { r: 9, g: 7, b: 5 } as const;

interface Star {
  fx: number;
  fy: number;
  ph: number;
  sp: number;
  r: number;
}

interface Mote {
  fx: number;
  fy: number;
  sp: number;
  ph: number;
  ax: number;
  ay: number;
  r: number;
  a: number;
}

class RetableMiniatureScene implements VersoScene {
  readonly id = "retable_miniature";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private active = false;
  private reduced = false;
  private pw = 0;
  private ph = 0;
  private md = 0;
  private t = 0;
  private lastTime = 0;
  private cycleIndex = -1;

  // deterministic per-cycle variation
  private lightFx = 0.5;
  private lightFy = 0.4;
  private lightMul = 1;
  private wingMax = 1.25;
  private stars: Star[] = [];
  private motes: Mote[] = [];

  private readonly pt = { x: 0.5, y: 0.5 };
  private readonly pc = { x: 0.5, y: 0.5 };

  private readonly onPointerMove: (event: PointerEvent) => void;

  constructor() {
    this.onPointerMove = (event: PointerEvent) => {
      const host = this.host;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      this.pt.x = clamp01((event.clientX - rect.left) / rect.width);
      this.pt.y = clamp01((event.clientY - rect.top) / rect.height);
    };
  }

  // ---- lifecycle -------------------------------------------------------------

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
    this.reseed();
    this.resize();
    if (this.reduced) this.still();
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
    if (this.reduced === reduced) return;
    this.reduced = reduced;
    if (reduced) {
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.still();
      return;
    }
    if (this.active && this.rafId === null) {
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.frame);
    }
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
    this.md = Math.min(w, h);

    const ctx = this.ctx;
    if (!ctx) return;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (this.reduced) this.still();
    else if (!this.active) this.freeze();
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
    this.stars = [];
    this.motes = [];
    this.host = null;
  }

  // ---- generation --------------------------------------------------------------

  private reseed(): void {
    const rnd = mulberry32((Math.random() * 0x7fffffff) | 0);
    this.lightFx = 0.47 + rnd() * 0.06;
    this.lightFy = 0.365 + rnd() * 0.055;
    this.lightMul = 0.9 + rnd() * 0.15;
    this.wingMax = 1.16 + rnd() * 0.14;
    this.stars = [];
    this.motes = [];

    const nStars = 15;
    for (let i = 0; i < nStars; i++) {
      this.stars.push({
        fx: WORLD_L + 0.018 + rnd() * (WORLD_R - WORLD_L - 0.036),
        fy: WORLD_T + 0.015 + rnd() * (WORLD_B - 0.03 - WORLD_T),
        ph: rnd() * TAU,
        sp: 1 + rnd() * 2,
        r: 0.6 + rnd() * 0.8,
      });
    }

    const nMotes = 13;
    for (let i = 0; i < nMotes; i++) {
      this.motes.push({
        fx: 0.335 + rnd() * 0.33,
        fy: 0.3 + rnd() * 0.46,
        sp: 0.45 + rnd() * 1.1,
        ph: rnd() * TAU,
        ax: 0.004 + rnd() * 0.008,
        ay: 0.005 + rnd() * 0.009,
        r: 0.8 + rnd() * 1,
        a: 0.07 + rnd() * 0.12,
      });
    }
  }

  // ---- animation ------------------------------------------------------------------

  private frame = (now: number): void => {
    if (!this.active || this.reduced) {
      this.rafId = null;
      return;
    }
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.t += dt;

    const cycle = Math.floor(this.t / CYCLE_SECONDS);
    if (cycle !== this.cycleIndex) {
      this.cycleIndex = cycle;
      this.reseed();
    }

    this.pc.x += (this.pt.x - this.pc.x) * 0.055;
    this.pc.y += (this.pt.y - this.pc.y) * 0.055;

    const u = (this.t % CYCLE_SECONDS) / CYCLE_SECONDS;
    this.drawScene(u, this.t, true);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Reduced-motion: the open world at its climax, static. */
  private still(): void {
    this.drawScene(0.85, 26, false);
  }

  /** Paused back face: current frame, frozen. */
  private freeze(): void {
    this.drawScene((this.t % CYCLE_SECONDS) / CYCLE_SECONDS, this.t, false);
  }

  // ---- rendering ---------------------------------------------------------------------

  private drawScene(u: number, t: number, live: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    const pw = this.pw;
    const ph = this.ph;
    const md = this.md;
    const dyn = live ? 1 : 0;
    const pkx = (this.pc.x - 0.5) * dyn;
    const pky = (this.pc.y - 0.5) * dyn;

    // ---- narrative state -------------------------------------------------------------
    const wingK = smoothstep(smooth(0.24, 0.38, u));
    const closeK = smoothstep(smooth(0.9, 1.0, u));
    const openK = wingK * (1 - closeK);
    const chamberA =
      smoothstep(smooth(0.26, 0.4, u)) * (1 - closeK * 0.7);
    const appearK = smoothstep(smooth(0.5, 0.6, u));
    const growK = smoothstep(smooth(0.58, 0.7, u));
    const peakK =
      smoothstep(smooth(0.78, 0.86, u)) *
      (1 - smoothstep(smooth(0.88, 0.95, u)));
    const decayK = 1 - smoothstep(smooth(0.93, 0.995, u));
    const brightK = (0.3 + 0.7 * growK) * (1 + 0.35 * peakK) * decayK;
    const coreK =
      appearK * (0.35 + 0.65 * growK) * (1 + 0.5 * peakK) * decayK * this.lightMul;
    const frontVis = smoothstep(smooth(0.5, 0.6, u));
    const interVis = smoothstep(smooth(0.56, 0.66, u));
    const worldVis = smoothstep(smooth(0.62, 0.74, u));
    const seamA =
      smoothstep(smooth(0.14, 0.18, u)) *
      (1 - smoothstep(smooth(0.24, 0.3, u))) *
      (0.5 + 0.5 * Math.sin(t * 3));

    // ---- room ------------------------------------------------------------------------
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    const bg = ctx.createLinearGradient(0, 0, 0, ph);
    bg.addColorStop(0, "#120d09");
    bg.addColorStop(0.55, "#0c0907");
    bg.addColorStop(1, "#0a0705");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, pw, ph);

    // a very faint warm halo where the object stands
    const halo = ctx.createRadialGradient(
      pw * 0.5, ph * 0.45, md * 0.1,
      pw * 0.5, ph * 0.45, md * 0.6,
    );
    halo.addColorStop(0, "rgba(40,29,19,0.35)");
    halo.addColorStop(1, "rgba(40,29,19,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, pw, ph);

    // ---- plinth ---------------------------------------------------------------------
    const [pxp, pyp] = this.offK(pkx, pky, md, 0.006);
    ctx.save();
    ctx.translate(pxp, pyp);
    this.drawPlinth(ctx, pw, ph);
    ctx.restore();

    // ---- the recess and its miniature world (several non-coplanar planes) ----------
    this.drawChamber(ctx, pw, ph, t, pkx, pky, md, dyn, {
      openK,
      brightK,
      coreK,
      chamberA,
      frontVis,
      interVis,
      worldVis,
    });

    // ---- the wooden frame (ring around the opening, drawn over the chamber edges) --
    const [pxf, pyf] = this.offK(pkx, pky, md, 0.008);
    ctx.save();
    ctx.translate(pxf, pyf);
    this.drawFrame(ctx, pw, ph, brightK);
    ctx.restore();

    // ---- the articulated panels ------------------------------------------------------
    const theta = this.wingMax * openK;
    const [pxw, pyw] = this.offK(pkx, pky, md, 0.008);
    ctx.save();
    ctx.translate(pxw, pyw);
    this.drawWing(ctx, pw, ph, -1, theta, openK);
    this.drawWing(ctx, pw, ph, 1, theta, openK);
    ctx.restore();

    // ---- the golden seam, during the object's wake -----------------------------------
    if (seamA > 0.01) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = css(GOLD, seamA * (0.35 + 0.3 * brightK));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pw * 0.5, ph * WING_T);
      ctx.lineTo(pw * 0.5, ph * WING_B);
      ctx.stroke();
    }

    // ---- the warm bloom at the climax --------------------------------------------------
    if (peakK > 0.02) {
      const bloom = ctx.createRadialGradient(
        pw * 0.5, ph * 0.5, md * 0.02,
        pw * 0.5, ph * 0.5, md * 0.3,
      );
      bloom.addColorStop(0, css(WARM, 0.06 * peakK));
      bloom.addColorStop(0.6, css(WARM, 0.028 * peakK));
      bloom.addColorStop(1, css(WARM, 0));
      ctx.fillStyle = bloom;
      ctx.fillRect(pw * 0.2, ph * 0.15, pw * 0.6, ph * 0.6);
    }

    // ---- a few discreet dust motes ----------------------------------------------------
    if (openK > 0.08 && brightK > 0.02) {
      this.drawMotes(ctx, pw, ph, t, pkx, pky, md, dyn, openK, brightK);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private offK(
    pkx: number,
    pky: number,
    md: number,
    k: number,
  ): [number, number] {
    return [pkx * md * k, pky * md * k];
  }

  // ---- plinth ------------------------------------------------------------------

  private drawPlinth(ctx: CanvasRenderingContext2D, pw: number, ph: number): void {
    const x = PLINTH_L * pw;
    const w = (PLINTH_R - PLINTH_L) * pw;
    const y = PLINTH_T * ph;
    const h = (PLINTH_B - PLINTH_T) * ph;

    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, css(WOOD_L, 1));
    g.addColorStop(1, css(WOOD_D, 1));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = css(GOLD, 0.38);
    ctx.fillRect(x, y, w, 1);

    ctx.fillStyle = css(WOOD_D, 0.9);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);

    // two small feet
    ctx.fillStyle = css(WOOD_D, 1);
    ctx.fillRect(x + w * 0.1, y + h, w * 0.08, ph * 0.012);
    ctx.fillRect(x + w * 0.82, y + h, w * 0.08, ph * 0.012);
  }

  // ---- the chamber and its depth planes -----------------------------------------

  private drawChamber(
    ctx: CanvasRenderingContext2D,
    pw: number,
    ph: number,
    t: number,
    pkx: number,
    pky: number,
    md: number,
    dyn: number,
    s: {
      readonly openK: number;
      readonly brightK: number;
      readonly coreK: number;
      readonly chamberA: number;
      readonly frontVis: number;
      readonly interVis: number;
      readonly worldVis: number;
    },
  ): void {
    if (s.chamberA < 0.01) return;
    const il = INT_L * pw;
    const ir = INT_R * pw;
    const it = INT_T * ph;
    const ib = INT_B * ph;

    // chamber walls — dark, warm, recessed
    const [ox, oy] = this.offK(pkx, pky, md, 0.008);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(il - 6, it - 6, ir - il + 12, ib - it + 12);
    ctx.clip();
    ctx.globalAlpha = s.chamberA;
    const cg = ctx.createLinearGradient(0, it, 0, ib);
    cg.addColorStop(0, css(CHAMBER, 1));
    cg.addColorStop(1, css(WOOD_D, 1));
    ctx.fillStyle = cg;
    ctx.fillRect(il, it, ir - il, ib - it);
    ctx.globalAlpha = 1;
    ctx.restore();

    // floor — a trapezoid receding into depth
    this.drawFloor(ctx, pw, ph, pkx, pky, md, s);

    // back world — the miniature night beyond
    this.drawWorld(ctx, pw, ph, t, pkx, pky, md, dyn, s);

    // intermediate plane: a row of thin columns
    this.drawColumns(ctx, pw, ph, pkx, pky, md, s);

    // front architectural plane: a small proscenium arch
    this.drawProscenium(ctx, pw, ph, pkx, pky, md, s);
  }

  private drawFloor(
    ctx: CanvasRenderingContext2D,
    pw: number,
    ph: number,
    pkx: number,
    pky: number,
    md: number,
    s: {
      readonly brightK: number;
    },
  ): void {
    if (s.brightK < 0.02) return;
    const [ox, oy] = this.offK(pkx, pky, md, 0.03);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(
      INT_L * pw - 6,
      WORLD_B * ph - 4,
      (INT_R - INT_L) * pw + 12,
      INT_B * ph - WORLD_B * ph + 8,
    );
    ctx.clip();

    const wl = WORLD_L * pw;
    const wr = WORLD_R * pw;
    const wb = WORLD_B * ph;
    const il = INT_L * pw;
    const ir = INT_R * pw;
    const ib = INT_B * ph;

    const fg = ctx.createLinearGradient(0, wb, 0, ib);
    fg.addColorStop(0, css(NIGHT_D, 1));
    fg.addColorStop(0.5, css(WOOD_D, 1));
    fg.addColorStop(1, css(WOOD_M, 1));
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(wl, wb);
    ctx.lineTo(wr, wb);
    ctx.lineTo(ir, ib);
    ctx.lineTo(il, ib);
    ctx.closePath();
    ctx.fill();

    // hairline edges in gold, catching the light
    ctx.globalAlpha = 0.1 * s.brightK;
    ctx.strokeStyle = css(GOLD, 1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wl, wb);
    ctx.lineTo(il, ib);
    ctx.moveTo(wr, wb);
    ctx.lineTo(ir, ib);
    ctx.stroke();

    // a soft warm glint on the floor under the light
    const glintY = lerp(wb, ib, 0.42);
    const gl = ctx.createRadialGradient(
      pw * 0.5, glintY, 0,
      pw * 0.5, glintY, md * 0.1,
    );
    gl.addColorStop(0, css(WARM, 0.1 * s.brightK));
    gl.addColorStop(1, css(WARM, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.ellipse(pw * 0.5, glintY, md * 0.09, md * 0.03, 0, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  private drawWorld(
    ctx: CanvasRenderingContext2D,
    pw: number,
    ph: number,
    t: number,
    pkx: number,
    pky: number,
    md: number,
    dyn: number,
    s: {
      readonly brightK: number;
      readonly coreK: number;
      readonly worldVis: number;
    },
  ): void {
    if (s.worldVis < 0.01 && s.brightK < 0.01) return;
    const [ox, oy] = this.offK(pkx, pky, md, 0.045);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = 1;
    const wl = WORLD_L * pw;
    const wr = WORLD_R * pw;
    const wt = WORLD_T * ph;
    const wb = WORLD_B * ph;
    ctx.beginPath();
    ctx.rect(wl - 8, wt - 8, wr - wl + 16, wb - wt + 16);
    ctx.clip();

    const worldA = lerp(0.45, 1, s.brightK) * s.worldVis;

    // the night sky
    if (worldA > 0.01) {
      ctx.globalAlpha = worldA;
      const sky = ctx.createLinearGradient(0, wt, 0, wb);
      sky.addColorStop(0, css(NIGHT, 1));
      sky.addColorStop(1, css(NIGHT_B, 1));
      ctx.fillStyle = sky;
      ctx.fillRect(wl, wt, wr - wl, wb - wt);
    }

    // stars
    for (let i = 0; i < this.stars.length; i++) {
      const st = this.stars[i];
      const tw = 0.5 + 0.5 * Math.sin(t * st.sp + st.ph);
      const a = worldA * (0.2 + 0.8 * tw) * 0.7;
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = css(IVORY, 1);
      ctx.beginPath();
      ctx.arc(st.fx * pw, st.fy * ph, st.r, 0, TAU);
      ctx.fill();
    }

    // a distant horizon — small hills and two tiny structures
    ctx.globalAlpha = worldA;
    ctx.beginPath();
    ctx.moveTo(wl, wb);
    const stepN = 9;
    for (let k = 0; k <= stepN; k++) {
      const x = wl + ((wr - wl) * k) / stepN;
      const hump =
        Math.sin(k * 1.9) * 0.008 * ph * (0.6 + 0.4 * Math.abs(Math.sin(k * 1.3)));
      ctx.lineTo(x, wb - 1 - hump);
    }
    ctx.lineTo(wr, wb);
    ctx.closePath();
    ctx.fillStyle = css(NIGHT_D, 1);
    ctx.fill();

    // tiny micro-architecture on the horizon line
    ctx.globalAlpha = worldA * 0.9;
    ctx.fillStyle = css(NIGHT_D, 1);
    ctx.fillRect(wl + (wr - wl) * 0.32, wb - 7, 3, 7);
    ctx.fillRect(wl + (wr - wl) * 0.62, wb - 5, 2.5, 5);
    ctx.fillStyle = css(NIGHT_B, 1);
    ctx.fillRect(wl + (wr - wl) * 0.32 - 1, wb - 9, 5, 2);
    ctx.fillRect(wl + (wr - wl) * 0.62 - 1, wb - 7, 4.5, 2);

    // a warm rim on the silhouette where the light falls
    if (s.coreK > 0.02) {
      const lx = this.lightX(pw, md, pkx, t, dyn);
      ctx.globalAlpha = s.coreK * 0.35;
      ctx.strokeStyle = css(WARM, 1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx - 12, wb);
      ctx.lineTo(lx + 12, wb);
      ctx.stroke();
    }

    // the distant warm light source, far away in the sky
    this.drawLightSourceInWorld(ctx, pw, ph, md, t, pkx, pky, dyn, s.coreK);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private lightX(pw: number, md: number, pkx: number, t: number, dyn: number): number {
    return (
      this.lightFx * pw +
      pkx * md * 0.05 +
      Math.sin(t * 0.4 + this.cycleIndex) * md * 0.004 * dyn
    );
  }

  private lightY(ph: number, md: number, pky: number, t: number, dyn: number): number {
    return (
      this.lightFy * ph +
      pky * md * 0.04 +
      Math.cos(t * 0.5 + this.cycleIndex) * ph * 0.006 * dyn
    );
  }

  private drawColumns(
    ctx: CanvasRenderingContext2D,
    pw: number,
    ph: number,
    pkx: number,
    pky: number,
    md: number,
    s: { readonly brightK: number; readonly interVis: number },
  ): void {
    const a = lerp(0.35, 1, s.brightK) * s.interVis;
    if (a < 0.02) return;
    const [ox, oy] = this.offK(pkx, pky, md, 0.03);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(
      INT_L * pw - 6,
      INT_T * ph - 6,
      (INT_R - INT_L) * pw + 12,
      INT_B * ph - INT_T * ph + 12,
    );
    ctx.clip();

    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = css(IVORY, 1);
    for (const fx of [0.405, 0.595]) {
      const x = fx * pw;
      ctx.fillRect(x - 2, 0.47 * ph, 4, 0.23 * ph);
    }
    // a tiny beam linking them
    ctx.globalAlpha = a * 0.4;
    ctx.fillRect(0.4 * pw, 0.462 * ph, 0.2 * pw, 2.5);

    ctx.restore();
  }

  private drawProscenium(
    ctx: CanvasRenderingContext2D,
    pw: number,
    ph: number,
    pkx: number,
    pky: number,
    md: number,
    s: { readonly brightK: number; readonly frontVis: number },
  ): void {
    const a = lerp(0.4, 1, s.brightK) * s.frontVis;
    if (a < 0.02) return;
    const [ox, oy] = this.offK(pkx, pky, md, 0.018);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(
      INT_L * pw - 6,
      INT_T * ph - 6,
      (INT_R - INT_L) * pw + 12,
      INT_B * ph - INT_T * ph + 12,
    );
    ctx.clip();

    const archR = (0.664 - 0.336) * 0.5 * pw;
    const archY = 0.5 * ph;

    ctx.globalAlpha = a;
    // two thin pillars
    ctx.fillStyle = css(IVORY, 1);
    ctx.fillRect(0.336 * pw - 2.5, 0.5 * ph, 5, 0.3 * ph);
    ctx.fillRect(0.664 * pw - 2.5, 0.5 * ph, 5, 0.3 * ph);
    // capitals
    ctx.fillStyle = css(GOLD, 1);
    ctx.fillRect(0.336 * pw - 4, 0.49 * ph, 8, 3);
    ctx.fillRect(0.664 * pw - 4, 0.49 * ph, 8, 3);
    // the arch itself
    ctx.strokeStyle = css(IVORY, 1);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(pw * 0.5, archY, archR, Math.PI, 0);
    ctx.stroke();
    // a keystone
    ctx.fillStyle = css(GOLD, 1);
    ctx.beginPath();
    ctx.arc(pw * 0.5, archY - archR, 2.4, 0, TAU);
    ctx.fill();

    ctx.restore();
  }

  // ---- the light source ---------------------------------------------------------

  private drawLightSourceInWorld(
    ctx: CanvasRenderingContext2D,
    pw: number,
    ph: number,
    md: number,
    t: number,
    pkx: number,
    pky: number,
    dyn: number,
    coreK: number,
  ): void {
    // draw the distant warm light inside the world clip
    if (coreK < 0.02) return;
    const lx = this.lightX(pw, md, pkx, t, dyn);
    const ly = this.lightY(ph, md, pky, t, dyn);

    const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, md * (0.045 + coreK * 0.03));
    glow.addColorStop(0, css(WARM, coreK * 0.55));
    glow.addColorStop(0.45, css(WARM, coreK * 0.18));
    glow.addColorStop(1, css(WARM, 0));
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lx, ly, md * (0.045 + coreK * 0.03), 0, TAU);
    ctx.fill();

    ctx.globalAlpha = Math.min(1, coreK);
    ctx.fillStyle = css(WARM, 1);
    ctx.beginPath();
    ctx.arc(lx, ly, 1.6 + coreK * 1.4, 0, TAU);
    ctx.fill();
  }

  // ---- the wooden frame ---------------------------------------------------------

  private drawFrame(
    ctx: CanvasRenderingContext2D,
    pw: number,
    ph: number,
    brightK: number,
  ): void {
    const ol = FRAME_L * pw;
    const or = FRAME_R * pw;
    const ot = FRAME_T * ph;
    const ob = FRAME_B * ph;
    const il = INT_L * pw;
    const ir = INT_R * pw;
    const it = INT_T * ph;
    const ib = INT_B * ph;

    // ring: outer rectangle minus the opening, so the recess stays visible
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(ol, ot, or - ol, ob - ot);
    ctx.rect(il, it, ir - il, ib - it);
    const g = ctx.createLinearGradient(0, ot, 0, ob);
    g.addColorStop(0, css(WOOD_L, 1));
    g.addColorStop(0.5, css(WOOD_M, 1));
    g.addColorStop(1, css(WOOD_D, 1));
    ctx.fillStyle = g;
    ctx.fill("evenodd");

    // bevels
    ctx.strokeStyle = css(WOOD_D, 0.9);
    ctx.lineWidth = 1;
    ctx.strokeRect(ol + 0.5, ot + 0.5, or - ol - 1, ob - ot - 1);
    ctx.strokeStyle = css(GOLD, 0.4 * (0.7 + 0.3 * brightK));
    ctx.strokeRect(il - 3.5, it - 3.5, ir - il + 7, ib - it + 7);

    // fine ivory inner line, a hair of light along the opening
    ctx.strokeStyle = css(IVORY, 0.08);
    ctx.lineWidth = 1;
    ctx.strokeRect(il + 2, it + 2, ir - il - 4, ib - it - 4);

    // the small gable above the frame
    ctx.beginPath();
    ctx.moveTo(ol, ot);
    ctx.lineTo(pw * 0.5, ARCH_T * ph);
    ctx.lineTo(or, ot);
    ctx.closePath();
    const gg = ctx.createLinearGradient(0, ot, 0, ARCH_T * ph);
    gg.addColorStop(0, css(WOOD_M, 1));
    gg.addColorStop(1, css(WOOD_L, 1));
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.strokeStyle = css(GOLD, 0.3);
    ctx.beginPath();
    ctx.moveTo(ol + 2, ot - 1);
    ctx.lineTo(pw * 0.5, ARCH_T * ph + 2);
    ctx.lineTo(or - 2, ot - 1);
    ctx.stroke();

    // apex finial
    ctx.fillStyle = css(GOLD, 0.55);
    ctx.beginPath();
    ctx.arc(pw * 0.5, ARCH_T * ph, 2.2, 0, TAU);
    ctx.fill();

    // corner accents
    ctx.fillStyle = css(GOLD, 0.28);
    for (const [cx, cy] of [
      [ol + 2, ot + 2],
      [or - 2, ot + 2],
      [ol + 2, ob - 2],
      [or - 2, ob - 2],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, 1.6, 0, TAU);
      ctx.fill();
    }
  }

  // ---- the articulated panels ----------------------------------------------------

  private drawWing(
    ctx: CanvasRenderingContext2D,
    pw: number,
    ph: number,
    side: -1 | 1,
    theta: number,
    openK: number,
  ): void {
    if (openK <= 0.004 && side === 1) return;
    const ww = WING_W * pw;
    const wh = (WING_B - WING_T) * ph;
    const cosW = Math.max(0.12, Math.cos(theta));

    ctx.save();
    if (side === -1) {
      ctx.translate(FRAME_L * pw, WING_T * ph);
      ctx.scale(cosW, 1);
      ctx.rotate(-theta * 0.06);
      ctx.fillStyle = css(WOOD_M, 1);
      ctx.fillRect(0, 0, ww, wh);
      ctx.fillStyle = css(WOOD_D, 1);
      ctx.fillRect(0, 0, 4, wh);
      ctx.strokeStyle = css(GOLD, 0.35);
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, ww - 1, wh - 1);
      // inner edge catch-light
      ctx.strokeStyle = css(IVORY, 0.12);
      ctx.beginPath();
      ctx.moveTo(ww - 3, 2);
      ctx.lineTo(ww - 3, wh - 2);
      ctx.stroke();
      // two panel seams
      ctx.strokeStyle = css(WOOD_D, 0.8);
      ctx.beginPath();
      ctx.moveTo(ww * 0.32, 2);
      ctx.lineTo(ww * 0.32, wh - 2);
      ctx.moveTo(ww * 0.66, 2);
      ctx.lineTo(ww * 0.66, wh - 2);
      ctx.stroke();
    } else {
      ctx.translate(FRAME_R * pw, WING_T * ph);
      ctx.scale(cosW, 1);
      ctx.rotate(theta * 0.06);
      ctx.fillStyle = css(WOOD_M, 1);
      ctx.fillRect(-ww, 0, ww, wh);
      ctx.fillStyle = css(WOOD_D, 1);
      ctx.fillRect(-ww, 0, 4, wh);
      ctx.strokeStyle = css(GOLD, 0.35);
      ctx.lineWidth = 1;
      ctx.strokeRect(-ww + 0.5, 0.5, ww - 1, wh - 1);
      ctx.strokeStyle = css(IVORY, 0.12);
      ctx.beginPath();
      ctx.moveTo(-ww + 3, 2);
      ctx.lineTo(-ww + 3, wh - 2);
      ctx.stroke();
      ctx.strokeStyle = css(WOOD_D, 0.8);
      ctx.beginPath();
      ctx.moveTo(-ww * 0.68, 2);
      ctx.lineTo(-ww * 0.68, wh - 2);
      ctx.moveTo(-ww * 0.34, 2);
      ctx.lineTo(-ww * 0.34, wh - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- the discreet dust motes ----------------------------------------------------

  private drawMotes(
    ctx: CanvasRenderingContext2D,
    pw: number,
    ph: number,
    t: number,
    pkx: number,
    pky: number,
    md: number,
    dyn: number,
    openK: number,
    brightK: number,
  ): void {
    const [ox, oy] = this.offK(pkx, pky, md, 0.028);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(
      INT_L * pw - 6,
      INT_T * ph - 6,
      (INT_R - INT_L) * pw + 12,
      INT_B * ph - INT_T * ph + 12,
    );
    ctx.clip();

    const gate = openK * brightK;
    ctx.fillStyle = css(WARM, 1);
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      const sway = Math.sin(t * m.sp + m.ph);
      const x = m.fx * pw + sway * m.ax * pw + pkx * md * 0.02 * dyn;
      const y = m.fy * ph + Math.cos(t * m.sp * 0.8 + m.ph) * m.ay * ph - t * 0.004 * m.sp * ph;
      const a = gate * m.a * (0.5 + 0.5 * sway);
      if (a < 0.008) continue;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export const retableMiniatureAnimation: VersoAnimationDefinition = {
  id: "retable_miniature",
  create: () => new RetableMiniatureScene(),
};