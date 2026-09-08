import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

// ---------------------------------------------------------------------------
// sketchbook_living — a living sketchbook ("carnet" verso, #3)
//
// Concept:
//   A small page of warm sketching paper. An invisible hand draws, with a
//   graphite pen, a tiny observatory in an imaginary landscape: horizon,
//   hills, dome, a window, a branch, a moon, a few faint stars — plus the
//   light graphite traces of hesitations around the sketch. Once finished,
//   the drawing refuses to stay still: it breathes, its window warms up, a
//   branch sways, a gust of wind crosses the lines, one leaf and one star
//   lift a few pixels off the page (a whisper of shadow underneath), the
//   page "imagines" a slightly different version, then an invisible eraser
//   sweeps the paper back to almost empty. The next page draws again.
//
// Cycle (t in seconds, one pass = CYCLE_SECONDS):
//   0-15%   an almost-empty page, a few pencil traces, the first lines
//   15-40%  narration: horizon -> hills -> structure -> roof -> window
//           -> branch -> moon -> stars (a pencil tip walks the lines)
//   40-60%  the drawing is finished, still
//   60-75%  the drawing lives: it breathes, the window glows, a gust of wind
//   75-86%  some elements leave the page (a leaf, a star, a thread of smoke)
//   86-94%  they settle back / the page imagines a slightly new drawing
//   94-100% an invisible eraser sweeps the page, traces remain, cycle restarts
//
// Pointer: extremely light — page parallax, lifted elements drift a couple of
// pixels, a star deflects. Local to the host, removed on destroy.
// Single RAF while active, none while inactive or reduced-motion.
// Reduced-motion: the finished composition, warm window light, static.
// ---------------------------------------------------------------------------

const CYCLE_SECONDS = 40;
const GUST_SECONDS = 7;
const DPR_MAX = 2;
const TAU = Math.PI * 2;

// Warm sketchbook paper + warm graphite (never cold gray, never neon).
const PAPER_TOP = "#f2e9d4";
const PAPER_MID = "#eadcbd";
const PAPER_BOTTOM = "#dfcfa8";
const VIGNETTE_EDGE = "rgba(138,110,76,0.26)";
const TIER = ["rgba(64,57,49,", "rgba(99,86,70,", "rgba(143,125,103,"];
const TIER_A = [0.92, 0.52, 0.3];
const GLOW_CORE = "rgba(238,182,112,0.8)";
const GLOW_MID = "rgba(238,182,112,0.3)";
const GLOW_NONE = "rgba(238,182,112,0)";
const FILL_A = 0.42;

// Narrative order of the parts (the drawing appears in this sequence).
const PART_ORDER = [
  "traces",
  "horizon",
  "hills",
  "structure",
  "roof",
  "window",
  "branch",
  "moon",
  "stars",
] as const;

interface Pt {
  readonly x: number; // fraction of page width
  readonly y: number; // fraction of page height
}

/** One polyline vertex. Jitters/offsets are in minDim units (px at draw). */
interface SegPt {
  readonly x: number;
  readonly y: number;
  readonly jx: number;
  readonly jy: number;
  readonly w: number; // width multiplier
  readonly a: number; // alpha multiplier
  readonly wind: number; // gust influence 0..1
  readonly keep: number; // eraser residual 0..1
}

interface Stroke {
  part: number; // index into PART_ORDER (-1 = always faint traces)
  color: number; // 0 dark | 1 mid | 2 light
  base: number; // stroke width in minDim units
  fill: number; // 0 = stroke only, >0 = closed fill alpha
  c0: number; // construction window start (u)
  c1: number; // construction window end (u)
  pts: readonly SegPt[];
  sw: number; // live sway amplitude (minDim units)
  swR: number; // sway rate
  swA: number; // sway phase
  lift: 0 | 1 | 2; // 0 ground, 1 leaf, 2 star (leaves the page)
  liftAmp: number; // lift height (minDim units)
  mvX: number; // page "imagination" shift (fraction of width)
  mvY: number; // page "imagination" shift (fraction of height)
  onlyAfter: boolean; // appears with the page's imagination
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const smooth = (a: number, b: number, x: number): number =>
  clamp01((x - a) / (b - a));
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

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

interface PushOpts {
  part: number;
  pts: readonly Pt[];
  color?: number;
  base?: number;
  fill?: number;
  sub?: number;
  jit?: number;
  sway?: number;
  swR?: number;
  lift?: 0 | 1 | 2;
  liftAmp?: number;
  mvX?: number;
  mvY?: number;
  onlyAfter?: boolean;
  windChance?: number;
}

class SketchbookLivingScene implements VersoScene {
  readonly id = "sketchbook_living";

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

  private paperGrad: CanvasGradient | null = null;
  private vigGrad: CanvasGradient | null = null;
  private grain: HTMLCanvasElement | null = null;

  private world: Stroke[] = [];
  private bp = 0.4; // breath phase
  private lp = 0.9; // window flicker phase

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

  // ---- lifecycle -----------------------------------------------------------

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
    } else if (this.active && this.rafId === null) {
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

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.paperGrad = ctx.createLinearGradient(0, 0, 0, h);
    this.paperGrad.addColorStop(0, PAPER_TOP);
    this.paperGrad.addColorStop(0.5, PAPER_MID);
    this.paperGrad.addColorStop(1, PAPER_BOTTOM);
    const vr = Math.min(w, h) * 0.62;
    this.vigGrad = ctx.createRadialGradient(w / 2, h / 2, vr * 0.35, w / 2, h / 2, vr * 1.55);
    this.vigGrad.addColorStop(0, "rgba(148,120,86,0)");
    this.vigGrad.addColorStop(0.55, "rgba(148,120,86,0.09)");
    this.vigGrad.addColorStop(1, VIGNETTE_EDGE);
    this.buildGrain();

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
    this.grain?.remove();
    this.canvas = null;
    this.ctx = null;
    this.paperGrad = null;
    this.vigGrad = null;
    this.grain = null;
    this.world = [];
    this.host = null;
  }

  // ---- generation -----------------------------------------------------------

  private buildGrain(): void {
    const grain = document.createElement("canvas");
    const gw = 96;
    const gh = 144;
    grain.width = gw;
    grain.height = gh;
    const gctx = grain.getContext("2d");
    if (!gctx) return;
    const img = gctx.createImageData(gw, gh);
    const d = img.data;
    for (let i = 0; i < gw * gh; i++) {
      const speck = Math.random() < 0.46;
      const patina = speck && Math.random() < 0.16;
      const v = patina ? 70 + Math.random() * 50 : 120 + Math.random() * 90;
      const a = speck ? (patina ? 8 + Math.random() * 8 : 3 + Math.random() * 9) : 0;
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = a;
    }
    gctx.putImageData(img, 0, 0);
    this.grain = grain;
  }

  private reseed(): void {
    const rnd = mulberry32((Math.random() * 0x7fffffff) | 0);
    this.bp = rnd() * TAU;
    this.lp = rnd() * TAU;
    this.world = [];
    this.buildWorld(rnd);
  }

  /** Samples a control polyline into an imperfect graphite stroke. */
  private pushStroke(
    opts: PushOpts,
    rnd: () => number,
    out: Stroke[]
  ): void {
    const sub = opts.sub ?? 3;
    const jit = opts.jit ?? 0.0042;
    const color = opts.color ?? 0;
    const base = opts.base ?? 0.0062;
    const windChance = opts.windChance ?? 0;
    const pts: SegPt[] = [];
    const src = opts.pts;
    for (let i = 0; i + 1 < src.length; i++) {
      const a = src[i];
      const b = src[i + 1];
      for (let s = 0; s < sub; s++) {
        const u = s / sub;
        pts.push({
          x: lerp(a.x, b.x, u) + (rnd() - 0.5) * jit,
          y: lerp(a.y, b.y, u) + (rnd() - 0.5) * jit * 0.8,
          jx: (rnd() - 0.5) * jit,
          jy: (rnd() - 0.5) * jit * 0.8,
          w: 0.8 + rnd() * 0.45,
          a: 0.72 + rnd() * 0.4,
          wind: windChance > 0 && rnd() < windChance ? 0.1 + rnd() * 0.9 : 0,
          keep: 0.02 + rnd() * 0.06,
        });
      }
    }
    const last = src[src.length - 1];
    pts.push({
      x: last.x + (rnd() - 0.5) * jit,
      y: last.y + (rnd() - 0.5) * jit * 0.8,
      jx: (rnd() - 0.5) * jit,
      jy: (rnd() - 0.5) * jit * 0.8,
      w: 0.8 + rnd() * 0.45,
      a: 0.72 + rnd() * 0.4,
      wind: 0,
      keep: 0.02 + rnd() * 0.06,
    });
    out.push({
      part: opts.part,
      color,
      base,
      fill: opts.fill ?? 0,
      c0: 0,
      c1: 1,
      pts,
      sw: opts.sway ?? 0,
      swR: opts.swR ?? 0.6,
      swA: rnd() * TAU,
      lift: opts.lift ?? 0,
      liftAmp: opts.liftAmp ?? 0,
      mvX: opts.mvX ?? 0,
      mvY: opts.mvY ?? 0,
      onlyAfter: opts.onlyAfter ?? false,
    });
  }

  private arc(
    cx: number,
    cy: number,
    r: number,
    a0: number,
    a1: number,
    n: number
  ): Pt[] {
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return pts;
  }

  private buildWorld(rnd: () => number): void {
    const w = this.world;

    // --- faint pencil traces (always present, very light) ---------------
    const trace = (pts: readonly Pt[]): void =>
      this.pushStroke({ part: -1, color: 2, base: 0.0034, jit: 0.006, pts }, rnd, w);
    trace([
      { x: 0.055, y: 0.93 },
      { x: 0.09, y: 0.88 },
      { x: 0.145, y: 0.915 },
    ]);
    trace([
      { x: 0.9, y: 0.87 },
      { x: 0.945, y: 0.83 },
      { x: 0.9, y: 0.785 },
    ]);
    trace([
      { x: 0.1, y: 0.06 },
      { x: 0.16, y: 0.09 },
      { x: 0.12, y: 0.13 },
    ]);
    trace([
      { x: 0.88, y: 0.075 },
      { x: 0.925, y: 0.12 },
      { x: 0.855, y: 0.145 },
    ]);
    trace([
      { x: 0.12, y: 0.615 },
      { x: 0.5, y: 0.6 },
      { x: 0.88, y: 0.62 },
    ]);

    // --- horizon ---------------------------------------------------------
    const horiz = (pts: readonly Pt[], color: number, base: number): void =>
      this.pushStroke({ part: 0, color, base, jit: 0.005, windChance: 0.5, pts }, rnd, w);
    horiz(
      [
        { x: 0.045, y: 0.568 },
        { x: 0.27, y: 0.555 },
        { x: 0.52, y: 0.548 },
        { x: 0.74, y: 0.56 },
        { x: 0.955, y: 0.576 },
      ],
      0,
      0.0065
    );
    horiz(
      [
        { x: 0.07, y: 0.588 },
        { x: 0.5, y: 0.568 },
        { x: 0.92, y: 0.596 },
      ],
      0,
      0.0046
    );
    this.pushStroke(
      { part: 0, color: 1, base: 0.004, jit: 0.005, pts: [{ x: 0.05, y: 0.602 }, { x: 0.95, y: 0.588 }] },
      rnd,
      w
    );

    // --- hills -------------------------------------------------------------
    const hill = (
      crest: readonly Pt[],
      fill: number,
      hatch: readonly Pt[][],
      jit = 0.005
    ): void => {
      this.pushStroke({ part: 1, color: 1, base: 0.0054, jit, fill, sub: 4, windChance: 0.35, pts: crest }, rnd, w);
      for (const hp of hatch)
        this.pushStroke({ part: 1, color: 2, base: 0.0036, jit: 0.004, pts: hp }, rnd, w);
    };
    // back-left hill
    hill(
      [
        { x: 0.0, y: 0.608 },
        { x: 0.16, y: 0.548 },
        { x: 0.34, y: 0.572 },
        { x: 0.505, y: 0.612 },
      ],
      0.045,
      [
        [{ x: 0.1, y: 0.572 }, { x: 0.12, y: 0.66 }],
        [{ x: 0.2, y: 0.575 }, { x: 0.24, y: 0.67 }],
        [{ x: 0.3, y: 0.575 }, { x: 0.33, y: 0.64 }],
      ]
    );
    // mid-right hill
    hill(
      [
        { x: 0.42, y: 0.62 },
        { x: 0.6, y: 0.556 },
        { x: 0.8, y: 0.596 },
        { x: 1.0, y: 0.63 },
      ],
      0.05,
      [
        [{ x: 0.55, y: 0.58 }, { x: 0.56, y: 0.68 }],
        [{ x: 0.68, y: 0.585 }, { x: 0.7, y: 0.685 }],
      ]
    );
    // front hill (the observatory's hill)
    hill(
      [
        { x: 0.3, y: 0.672 },
        { x: 0.518 + rnd() * 0.008, y: 0.61 },
        { x: 0.78, y: 0.685 },
        { x: 0.94, y: 0.716 },
      ],
      0.06,
      [
        [{ x: 0.35, y: 0.66 }, { x: 0.375, y: 0.75 }],
        [{ x: 0.44, y: 0.65 }, { x: 0.47, y: 0.74 }],
        [{ x: 0.62, y: 0.66 }, { x: 0.645, y: 0.74 }],
      ]
    );

    // --- observatory structure --------------------------------------------
    const ox = 0.515;
    const top = 0.408;
    const bottom = 0.55;
    const side = (x1: number, x2: number): void =>
      this.pushStroke(
        { part: 2, color: 0, base: 0.006, pts: [{ x: x1, y: bottom }, { x: x2, y: top }] },
        rnd,
        w
      );
    side(ox - 0.065, ox - 0.068);
    side(ox + 0.065, ox + 0.068);
    this.pushStroke(
      { part: 2, color: 0, base: 0.0055, pts: [{ x: ox - 0.068, y: top }, { x: ox + 0.068, y: top }] },
      rnd,
      w
    );
    this.pushStroke(
      { part: 2, color: 0, base: 0.0055, pts: [{ x: ox - 0.07, y: bottom }, { x: ox + 0.07, y: bottom }] },
      rnd,
      w
    );
    // faint central construction line
    this.pushStroke(
      {
        part: 2,
        color: 2,
        base: 0.0033,
        jit: 0.003,
        pts: [
          { x: ox - 0.06, y: bottom },
          { x: ox, y: 0.36 },
          { x: ox + 0.06, y: top },
        ],
      },
      rnd,
      w
    );
    // door + step
    this.pushStroke(
      {
        part: 2,
        color: 0,
        base: 0.0046,
        pts: [
          { x: ox - 0.018, y: bottom },
          { x: ox - 0.018, y: bottom - 0.045 },
          { x: ox + 0.018, y: bottom - 0.045 },
          { x: ox + 0.018, y: bottom },
        ],
      },
      rnd,
      w
    );
    this.pushStroke(
      { part: 2, color: 1, base: 0.0038, pts: [{ x: ox - 0.05, y: bottom + 0.014 }, { x: ox + 0.05, y: bottom + 0.014 }] },
      rnd,
      w
    );

    // --- dome roof -----------------------------------------------------------
    const roof = this.arc(ox, top + 0.012, 0.078, Math.PI, 0, 9);
    this.pushStroke({ part: 3, color: 0, base: 0.006, jit: 0.004, pts: roof }, rnd, w);
    this.pushStroke(
      { part: 3, color: 1, base: 0.004, pts: [{ x: ox - 0.082, y: top + 0.012 }, { x: ox + 0.082, y: top + 0.012 }] },
      rnd,
      w
    );
    this.pushStroke(
      { part: 3, color: 0, base: 0.0044, pts: [{ x: ox, y: top - 0.066 }, { x: ox, y: top - 0.085 }] },
      rnd,
      w
    );

    // --- window ---------------------------------------------------------------
    const winX = ox;
    const winY = top + 0.055;
    const winR = 0.021;
    this.pushStroke(
      { part: 4, color: 0, base: 0.005, pts: this.arc(winX, winY, winR, 0, TAU, 12) },
      rnd,
      w
    );
    this.pushStroke(
      { part: 4, color: 1, base: 0.0036, pts: [{ x: winX, y: winY - winR * 0.85 }, { x: winX, y: winY + winR * 0.85 }] },
      rnd,
      w
    );
    this.pushStroke(
      { part: 4, color: 1, base: 0.0036, pts: [{ x: winX - winR * 0.85, y: winY }, { x: winX + winR * 0.85, y: winY }] },
      rnd,
      w
    );
    // the window imagines itself open (appears during the transformation)
    this.pushStroke(
      {
        part: 4,
        color: 0,
        base: 0.0042,
        onlyAfter: true,
        pts: [
          { x: winX - winR * 0.55, y: winY - winR * 0.5 },
          { x: winX + winR * 0.5, y: winY - winR * 0.35 },
          { x: winX + winR * 0.62, y: winY + winR * 0.55 },
          { x: winX + winR * 0.3, y: winY + winR * 0.75 },
        ],
      },
      rnd,
      w
    );

    // --- branch (bottom-left corner) --------------------------------------------
    this.pushStroke(
      {
        part: 5,
        color: 0,
        base: 0.0058,
        jit: 0.006,
        windChance: 0.4,
        pts: [
          { x: 0.02, y: 0.96 },
          { x: 0.075, y: 0.84 },
          { x: 0.14, y: 0.72 },
          { x: 0.21, y: 0.615 + rnd() * 0.008 },
        ],
      },
      rnd,
      w
    );
    this.pushStroke(
      {
        part: 5,
        color: 1,
        base: 0.0038,
        pts: [
          { x: 0.1, y: 0.8 },
          { x: 0.065 + rnd() * 0.004, y: 0.74 },
        ],
      },
      rnd,
      w
    );
    this.pushStroke(
      {
        part: 5,
        color: 1,
        base: 0.0038,
        pts: [
          { x: 0.145, y: 0.735 },
          { x: 0.17, y: 0.66 },
        ],
      },
      rnd,
      w
    );
    // the little leaf that leaves the page
    this.pushStroke(
      {
        part: 5,
        color: 1,
        base: 0.0044,
        jit: 0.004,
        lift: 1,
        liftAmp: 0.013,
        sway: 0.004,
        swR: 0.55,
        pts: [
          { x: 0.09, y: 0.665 },
          { x: 0.073, y: 0.648 },
          { x: 0.066, y: 0.628 },
          { x: 0.078, y: 0.615 },
          { x: 0.092, y: 0.628 },
          { x: 0.098, y: 0.648 },
          { x: 0.09, y: 0.665 },
        ],
      },
      rnd,
      w
    );
    // a grounded leaf lower on the stem
    this.pushStroke(
      {
        part: 5,
        color: 2,
        base: 0.004,
        jit: 0.004,
        pts: [
          { x: 0.055, y: 0.838 },
          { x: 0.038, y: 0.815 },
          { x: 0.026, y: 0.792 },
          { x: 0.042, y: 0.782 },
          { x: 0.056, y: 0.805 },
          { x: 0.058, y: 0.826 },
          { x: 0.055, y: 0.838 },
        ],
      },
      rnd,
      w
    );

    // --- moon (thin crescent) --------------------------------------------------
    this.pushStroke(
      { part: 6, color: 1, base: 0.0044, jit: 0.003, pts: this.arc(0.205, 0.16, 0.042, TAU * 0.14, TAU * 0.59, 8) },
      rnd,
      w
    );
    this.pushStroke(
      { part: 6, color: 1, base: 0.0044, jit: 0.003, pts: this.arc(0.216, 0.156, 0.046, TAU * 0.625, TAU * 0.98, 8) },
      rnd,
      w
    );

    // --- stars ------------------------------------------------------------------
    const cross = (sx: number, sy: number, part: number): void =>
      this.pushStroke(
        {
          part,
          color: 0,
          base: 0.0036,
          pts: [
            { x: sx - 0.011, y: sy },
            { x: sx + 0.011, y: sy },
            { x: sx, y: sy - 0.011 },
            { x: sx, y: sy + 0.011 },
          ],
        },
        rnd,
        w
      );
    const dot = (sx: number, sy: number, part: number): void =>
      this.pushStroke(
        { part, color: 0, base: 0.0038, pts: [{ x: sx, y: sy }, { x: sx + 0.0032, y: sy }] },
        rnd,
        w
      );
    const jr = 0.012;
    cross(0.14 + (rnd() - 0.5) * jr, 0.095 + (rnd() - 0.5) * jr, 7);
    dot(0.31 + (rnd() - 0.5) * jr, 0.12 + (rnd() - 0.5) * jr, 7);
    cross(0.46 + (rnd() - 0.5) * jr, 0.075 + (rnd() - 0.5) * jr, 7);
    dot(0.64 + (rnd() - 0.5) * jr, 0.1 + (rnd() - 0.5) * jr, 7);
    // the floating star: drifts slowly, and leaves the page
    this.pushStroke(
      {
        part: 7,
        color: 0,
        base: 0.0042,
        sway: 0.005,
        swR: 0.32,
        lift: 2,
        liftAmp: 0.02,
        mvX: 0.014,
        mvY: -0.01,
        pts: [
          { x: 0.78 + (rnd() - 0.5) * jr, y: 0.145 + (rnd() - 0.5) * jr },
          { x: 0.786 + (rnd() - 0.5) * jr, y: 0.145 + (rnd() - 0.5) * jr },
          { x: 0.783 + (rnd() - 0.5) * jr, y: 0.139 + (rnd() - 0.5) * jr },
          { x: 0.783 + (rnd() - 0.5) * jr, y: 0.151 + (rnd() - 0.5) * jr },
        ],
      },
      rnd,
      w
    );
    dot(0.88 + (rnd() - 0.5) * jr, 0.205 + (rnd() - 0.5) * jr, 7);

    // a small extra ridge the page imagines during the transformation
    this.pushStroke(
      {
        part: 1,
        color: 2,
        base: 0.0036,
        onlyAfter: true,
        pts: [
          { x: 0.34, y: 0.7 },
          { x: 0.5, y: 0.68 + rnd() * 0.012 },
          { x: 0.66, y: 0.706 },
        ],
      },
      rnd,
      w
    );

    // --- construction slots: narrative timing --------------------------------
    const START = 0.15;
    const SPAN = 0.27;
    for (const st of w) {
      if (st.part < 0) {
        st.c0 = 0;
        st.c1 = 0.5;
        continue;
      }
      const slot = START + (st.part / PART_ORDER.length) * SPAN + rnd() * 0.012;
      st.c0 = slot;
      st.c1 = slot + 0.022 + rnd() * 0.02;
    }
  }

  // ---- animation ---------------------------------------------------------------

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

    this.pc.x += (this.pt.x - this.pc.x) * 0.07;
    this.pc.y += (this.pt.y - this.pc.y) * 0.07;

    const u = (this.t % CYCLE_SECONDS) / CYCLE_SECONDS;
    this.drawScene(u, this.t, true);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Reduced-motion: the finished drawing, warm window, static. */
  private still(): void {
    this.drawScene(0.6, 12, false);
  }

  /** Paused back face: keep the current page visible, frozen. */
  private freeze(): void {
    this.drawScene((this.t % CYCLE_SECONDS) / CYCLE_SECONDS, this.t, false);
  }

  // ---- rendering -----------------------------------------------------------------

  private drawScene(u: number, t: number, live: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    const pw = this.pw;
    const ph = this.ph;
    const md = this.md;
    const dyn = live ? 1 : 0;

    const livingK =
      smoothstep(smooth(0.4, 0.46, u)) * (1 - smoothstep(smooth(0.86, 0.94, u)));
    const transformK = smoothstep(smooth(0.862, 0.94, u));
    const liftK =
      smoothstep(smooth(0.75, 0.8, u)) * (1 - smoothstep(smooth(0.84, 0.9, u)));
    const eraseK = smoothstep(smooth(0.94, 0.985, u));
    const glowK = smoothstep(smooth(0.42, 0.48, u));

    const gp = (t % GUST_SECONDS) / GUST_SECONDS;
    const gustPulse = Math.sin(gp * TAU - 1.57);
    const gustA = livingK * dyn * gustPulse * gustPulse;
    const gustX = lerp(0.1, 0.9, gp) * pw;

    // paper
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.paperGrad ?? PAPER_TOP;
    ctx.fillRect(0, 0, pw, ph);
    if (this.vigGrad) {
      ctx.fillStyle = this.vigGrad;
      ctx.fillRect(0, 0, pw, ph);
    }
    if (this.grain) {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.drawImage(this.grain, 0, 0, pw, ph);
    }

    // the page breathes as a whole and drifts imperceptibly with the pointer
    ctx.save();
    const s = 1 + 0.0022 * livingK * dyn * Math.sin(t * 0.55 + this.bp);
    ctx.translate(pw * 0.5, ph * 0.5);
    ctx.scale(s, s);
    ctx.translate(-pw * 0.5, -ph * 0.5);
    ctx.translate(
      (this.pc.x - 0.5) * md * 0.01 * dyn,
      (this.pc.y - 0.5) * md * 0.01 * dyn
    );

    const eraseScale = md * 0.2;
    const ex = lerp(0.08, 0.92, eraseK) * pw + Math.sin(eraseK * 9 + 2) * pw * 0.02;
    const ey = lerp(0.9, 0.22, eraseK) * ph + Math.sin(eraseK * 11 - 1) * ph * 0.018;

    let tip: { x: number; y: number } | null = null;
    let tipBest = -1;

    for (const st of this.world) {
      const g = smoothstep(clamp01((u - st.c0) / Math.max(0.0001, st.c1 - st.c0)));
      if (g <= 0.001) continue;

      const n = st.pts.length;
      const cov = (n - 1) * g;
      const full = Math.floor(cov);
      const frac = cov - full;

      const swK = livingK * dyn * st.sw;
      const oX =
        Math.sin(t * st.swR + st.swA) * swK +
        st.mvX * transformK * pw * dyn +
        (this.pc.x - 0.5) * md * 0.016 * (st.lift > 0 ? liftK : 0);
      const oY =
        Math.cos(t * st.swR * 0.8 + st.swA) * swK * 0.7 -
        liftK * st.liftAmp * md +
        st.mvY * transformK * ph * dyn;

      ctx.lineCap = "round";
      for (let i = 1; i < n && i <= full + 1; i++) {
        const p = st.pts[i];
        const q = st.pts[i - 1];

        let x1 = q.x * pw + q.jx * md + oX;
        let y1 = q.y * ph + q.jy * md + oY;
        let x2 = p.x * pw + p.jx * md + oX;
        let y2 = p.y * ph + p.jy * md + oY;

        if (gustA > 0.02 && p.wind > 0) {
          const mx = (x1 + x2) * 0.5;
          const near = 1 - clamp01(Math.abs(mx - gustX) / (pw * 0.18));
          const gWin = p.wind * near * gustA;
          const gx = gWin * Math.sin(p.y * 11 + t * 2.4) * md * 0.007;
          const gy = gWin * Math.sin(p.y * 9 - t * 1.9) * md * 0.005;
          x1 += gx;
          y1 += gy;
          x2 += gx;
          y2 += gy;
        }

        let alpha = q.a * TIER_A[st.color];
        if (st.onlyAfter) alpha *= transformK;
        if (i === full + 1 && full < n - 1) alpha *= frac;

        let keep = 1;
        if (eraseK > 0) {
          const mdx = (x1 + x2) * 0.5 - ex;
          const mdy = (y1 + y2) * 0.5 - ey;
          const d = Math.hypot(mdx, mdy);
          const rem = 1 - smooth(0.85, 2.1, d / eraseScale);
          keep = 1 - (1 - rem) * eraseK * (1 - p.keep);
          alpha *= keep;
        }
        if (alpha <= 0.004 || keep <= 0) continue;

        ctx.globalAlpha = 1;
        ctx.strokeStyle = TIER[st.color] + alpha.toFixed(4) + ")";
        ctx.lineWidth = Math.max(0.5, st.base * md * p.w);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (st.lift > 0 && liftK > 0.02) {
          ctx.globalAlpha = alpha * 0.16 * liftK;
          ctx.strokeStyle = TIER[st.color] + "0.18)";
          ctx.beginPath();
          ctx.moveTo(x1 + md * 0.008, y1 + md * 0.01);
          ctx.lineTo(x2 + md * 0.008, y2 + md * 0.01);
          ctx.stroke();
        }
      }

      // the pencil tip walking the current line
      if (live && !st.onlyAfter && cov > 0 && cov < n - 1 && tipBest < st.c0) {
        tipBest = st.c0;
        const idx = Math.min(n - 1, full + 1);
        const q = st.pts[idx];
        tip = { x: q.x * pw + q.jx * md + oX, y: q.y * ph + q.jy * md + oY };
      }

      // hills shading fill (soft graphite wash)
      if (st.fill > 0 && st.part >= 0 && cov > 0.5) {
        const fillA = st.fill * smoothstep(clamp01(cov)) * (1 - eraseK * 0.85);
        if (fillA > 0.004) {
          ctx.beginPath();
          ctx.moveTo(
            st.pts[0].x * pw + st.pts[0].jx * md + oX,
            st.pts[0].y * ph + st.pts[0].jy * md + oY
          );
          for (let i = 1; i < n; i++)
            ctx.lineTo(
              st.pts[i].x * pw + st.pts[i].jx * md + oX,
              st.pts[i].y * ph + st.pts[i].jy * md + oY
            );
          ctx.lineTo(st.pts[n - 1].x * pw + pw * 0.06, ph);
          ctx.lineTo(st.pts[0].x * pw - pw * 0.02, ph);
          ctx.closePath();
          ctx.globalAlpha = fillA * FILL_A;
          ctx.fillStyle = TIER[1] + "0.9)";
          ctx.fill();
        }
      }
    }

    // warm light in the observatory window
    const winX = 0.515 * pw;
    const winY = 0.463 * ph;
    if (glowK > 0.005) {
      const flick = live ? 0.6 + 0.34 * Math.sin(t * 1.1 + this.lp) : 0.78;
      const ga = glowK * flick * (1 - eraseK);
      if (ga > 0.006) {
        const r = md * 0.105;
        const g = ctx.createRadialGradient(winX, winY, 0, winX, winY, r);
        g.addColorStop(0, GLOW_CORE);
        g.addColorStop(0.4, GLOW_MID);
        g.addColorStop(1, GLOW_NONE);
        ctx.globalAlpha = ga;
        ctx.fillStyle = g;
        ctx.fillRect(winX - r, winY - r, r * 2, r * 2);
      }
    }

    // a thread of smoke lifting off the dome as the page lets elements go
    if (liftK > 0.02 && eraseK < 0.9) {
      const sx = 0.515 * pw;
      const sy = 0.336 * ph;
      ctx.globalAlpha = liftK * 0.24 * (1 - eraseK);
      ctx.strokeStyle = TIER[2] + "0.6)";
      ctx.lineWidth = Math.max(0.6, md * 0.0038);
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const yy = sy - i * ph * 0.011;
        const xx = sx + Math.sin(t * 1.2 + i * 0.85 + this.bp) * md * 0.008;
        if (i === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }

    // the faint gust streak crossing a few lines
    if (gustA > 0.04) {
      ctx.globalAlpha = gustA * 0.11;
      ctx.strokeStyle = TIER[2] + "0.9)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const gx = gustX + (i - 4) * pw * 0.045;
        const gy = ph * (0.52 + (i % 2) * 0.02) + Math.sin(i * 1.7) * md * 0.006;
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }

    // the pencil tip on the page
    if (tip) {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = TIER[0] + "0.95)";
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, Math.max(0.7, md * 0.0026), 0, TAU);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export const sketchbookLivingAnimation: VersoAnimationDefinition = {
  id: "sketchbook_living",
  create: () => new SketchbookLivingScene(),
};