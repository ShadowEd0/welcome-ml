// ARCHIVÉ (Mission #18) : prototype retiré du registry actif — conservé ici
// pour référence. Non importé par scenes/index.ts, donc absent du bundle.
import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../../types";

// ---------------------------------------------------------------------------
// porcelain_memory — a piece of white porcelain that remembers
//
// Concept:
//   A small, slightly asymmetrical artisan vessel drifts in a very dark,
//   warm-charcoal space. It looks almost clean. Then fine surface marks —
//   nerves, engraved lines, tiny drawings — slowly grow along the porcelain
//   curvature: these marks are memories. During the central moment they
//   compose a small abstract scene on the belly (a branch, a window, a
//   crescent moon). Around the signature moment a few fragments lift just a
//   few pixels off the surface with a faint shadow beneath, as if the memory
//   were no longer entirely trapped in the object; they settle back, a
//   slightly different variant of the same memory appears, then every trace
//   fades away and the vessel returns to almost-clean white. It remembers
//   differently on every cycle.
//
// Cycle (t in seconds, one pass = CYCLE_SECONDS):
//   0-15%   a nearly clean vessel; one tiny first mark appears
//   15-40%  traces develop progressively, following the curvature
//   40-60%  the memory is composed: branch, window, moon, few fragments
//   60-75%  a few fragments lift a few pixels off the surface (soft shadow)
//   75-90%  they settle back; the same memory appears in a slight variant
//   90-100% every trace disappears, the vessel returns clean, cycle restarts
//
// Palette: ivory/off-white porcelain, warm-graphite memories (one barely
// present cool nuance), very dark warm background. Deliberately different
// from light_tailor: no dominant golden light network.
//
// Pointer: extremely light page/pointer parallax and a faint drift of the
// lifted fragments. Local to the host, removed on destroy.
// Single RAF while active, none while inactive or reduced-motion.
// Reduced-motion: the completed memory, static.
// ---------------------------------------------------------------------------

const CYCLE_SECONDS = 27;
const DPR_MAX = 2;
const TAU = Math.PI * 2;

const BG_TOP = "#1b150c";
const BG_MID = "#100d09";
const BG_BOT = "#0a0806";
const VIGNETTE = "rgba(0,0,0,0.42)";
const SHADOW_CORE = "rgba(0,0,0,0.48)";
const SHADOW_EDGE = "rgba(0,0,0,0)";

// Porcelain: ivory, off-white, soft warm grays. Directional light, matte.
const PORCELAIN_STOPS = [
  [0, "#e7ddc4"],
  [0.38, "#f8f2e1"],
  [0.6, "#e3d9c1"],
  [0.8, "#cdc0a4"],
  [1, "#b0a088"],
] as const;
const MOUTH_IN = "#847767";
const OCCLUDE_FAR = "rgba(126,111,91,0.16)";
const OCCLUDE_NEAR = "rgba(92,80,64,0.26)";
const HIGHLIGHT = "rgba(255,252,243,0.5)";

// Memories: warm graphite, one barely-there cool accent.
const TRACE = ["rgba(84,76,60,", "rgba(110,100,82,", "rgba(150,138,118,"] as const;
const TRACE_A = [0.72, 0.46, 0.3];
const COOL_ACCENT = "rgba(168,180,198,0.5)";

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

/** Smooth interpolation through knots [[t,y], ...] (monotone t, exact fit). */
function curve(knots: readonly (readonly [number, number])[]): (t: number) => number {
  return (t: number) => {
    const n = knots.length;
    if (t <= knots[0][0]) return knots[0][1];
    if (t >= knots[n - 1][0]) return knots[n - 1][1];
    let i = 1;
    while (i < n - 1 && knots[i][0] < t) i++;
    const a = knots[i - 1];
    const b = knots[i];
    let tanA = 0;
    let tanB = 0;
    if (i - 2 >= 0) tanA = (b[1] - knots[i - 2][1]) / (b[0] - knots[i - 2][0]);
    if (i + 1 < n) tanB = (knots[i + 1][1] - a[1]) / (knots[i + 1][0] - a[0]);
    const u = (t - a[0]) / (b[0] - a[0]);
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    return h00 * a[1] + h10 * tanA * (b[0] - a[0]) + h01 * b[1] + h11 * tanB * (b[0] - a[0]);
  };
}

// Vessel silhouette: half-width (left / right, in pw fractions) vs t (0 bottom → 1 top).
// Left and right are slightly different → the pot is gently asymmetrical.
const LEFT_PROFILE: readonly (readonly [number, number])[] = [
  [0.0, 0.105], [0.04, 0.14], [0.1, 0.178], [0.2, 0.212], [0.32, 0.226],
  [0.44, 0.222], [0.58, 0.162], [0.72, 0.176], [0.85, 0.138], [0.93, 0.105],
  [0.97, 0.156], [1.0, 0.146],
];
const RIGHT_PROFILE: readonly (readonly [number, number])[] = [
  [0.0, 0.112], [0.05, 0.15], [0.12, 0.182], [0.22, 0.208], [0.36, 0.22],
  [0.48, 0.206], [0.6, 0.15], [0.74, 0.166], [0.86, 0.132], [0.94, 0.092],
  [0.98, 0.152], [1.0, 0.144],
];
const WL = curve(LEFT_PROFILE);
const WR = curve(RIGHT_PROFILE);

interface PtF {
  readonly x: number; // fraction of pw
  readonly y: number; // fraction of ph
}

interface TracePt {
  readonly x: number;
  readonly y: number;
  readonly w: number; // width multiplier
  readonly a: number; // alpha multiplier
  readonly jx: number; // jitter, fraction of md
  readonly jy: number;
}

interface Trace {
  color: number; // 0 dark-warm | 1 mid | 2 faint
  base: number; // width, fraction of md
  c0: number; // construction window start (u)
  c1: number; // construction window end (u)
  lift: number; // 0 stays on surface, >0 lifts (md fraction distance)
  mvX: number; // variant shift, fraction of pw
  mvY: number; // variant shift, fraction of ph
  onlyAfter: boolean; // appears only inside the variant moment
  cool: boolean; // the single cool nuance
  pts: readonly TracePt[];
}

const AXIS = 0.5;
const Y_TOP = 0.23;
const Y_BOT = 0.85;

/** Map a surface coordinate (t in [0,1], u in [-1,1]) to a canvas fraction. */
function surfacePt(t: number, u: number): PtF {
  const half = u >= 0 ? WR(t) : WL(t);
  const x = AXIS + u * half;
  return { x, y: Y_BOT - t * (Y_BOT - Y_TOP) };
}

class PorcelainMemoryScene implements VersoScene {
  readonly id = "porcelain_memory";

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

  private trs: Trace[] = [];

  // pointer (extremely light)
  private readonly pt = { x: 0.5, y: 0.5 };
  private readonly pc = { x: 0.5, y: 0.5 };

  // per-resize statics
  private bgGrad: CanvasGradient | null = null;
  private vignGrad: CanvasGradient | null = null;
  private shadowGrad: CanvasGradient | null = null;
  private porcelainGrad: CanvasGradient | null = null;
  private occGrad: CanvasGradient | null = null;

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

    this.bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    this.bgGrad.addColorStop(0, BG_TOP);
    this.bgGrad.addColorStop(0.55, BG_MID);
    this.bgGrad.addColorStop(1, BG_BOT);

    const vr = Math.min(w, h) * 0.85;
    this.vignGrad = ctx.createRadialGradient(w / 2, h * 0.48, vr * 0.3, w / 2, h * 0.48, vr);
    this.vignGrad.addColorStop(0, "rgba(0,0,0,0)");
    this.vignGrad.addColorStop(1, VIGNETTE);

    // cast shadow pool under the pot
    this.shadowGrad = ctx.createRadialGradient(w * AXIS, h * 0.87, 0, w * AXIS, h * 0.87, w * 0.2);
    this.shadowGrad.addColorStop(0, SHADOW_CORE);
    this.shadowGrad.addColorStop(1, SHADOW_EDGE);

    // porcelain body lighting (upper-left directional)
    this.porcelainGrad = ctx.createLinearGradient(w * 0.16, h * 0.2, w * 0.78, h * 0.88);
    for (const [p, c] of PORCELAIN_STOPS) this.porcelainGrad.addColorStop(p, c);

    this.occGrad = ctx.createLinearGradient(w * 0.42, 0, w * 0.72, 0);
    this.occGrad.addColorStop(0, "rgba(126,111,91,0)");
    this.occGrad.addColorStop(1, "rgba(104,90,71,0.3)");

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
    this.bgGrad = null;
    this.vignGrad = null;
    this.shadowGrad = null;
    this.porcelainGrad = null;
    this.occGrad = null;
    this.trs = [];
    this.host = null;
  }

  // ---- generation -----------------------------------------------------------

  private reseed(): void {
    const rnd = mulberry32((Math.random() * 0x7fffffff) | 0);
    this.trs = [];
    this.buildWorld(rnd);
  }

  /** Push a trace, mapping surface points (t,u) → canvas fractions. */
  private pushTrace(
    opts: {
      color?: number;
      base?: number;
      c0?: number;
      c1?: number;
      lift?: number;
      mvX?: number;
      mvY?: number;
      onlyAfter?: boolean;
      cool?: boolean;
      jit?: number;
      pts: readonly PtF[];
    },
    rnd: () => number,
    out: Trace[],
    minU = -1,
    maxU = 1
  ): void {
    const jit = opts.jit ?? 0.0028;
    const pts: TracePt[] = [];
    const src = opts.pts;
    for (let i = 0; i + 1 < src.length; i++) {
      const a = src[i];
      const b = src[i + 1];
      const steps = Math.max(1, Math.round(0.5 + Math.abs(b.x - a.x) * 60));
      for (let s = 0; s < steps; s++) {
        const u = s / steps;
        const pu = a.x + (b.x - a.x) * u;
        pts.push({
          x: a.x + (b.x - a.x) * u,
          y: a.y + (b.y - a.y) * u + (rnd() - 0.5) * jit * 4,
          jx: (rnd() - 0.5) * jit,
          jy: (rnd() - 0.5) * jit,
          w: 0.75 + rnd() * 0.5,
          a: 0.7 + rnd() * 0.3,
        });
        if ((s === 0 || s === steps - 1) && pu < minU) return;
        if ((s === 0 || s === steps - 1) && pu > maxU) return;
      }
    }
    // drop traces that would leave the porcelain surface
    for (const p of pts) {
      const t = (Y_BOT - p.y) / (Y_BOT - Y_TOP);
      if (t < -0.02 || t > 1.02) return;
      const half = p.x >= AXIS ? WR(Math.min(1, Math.max(0, t))) : WL(Math.min(1, Math.max(0, t)));
      const lo = AXIS - half * 0.96;
      const hi = AXIS + half * 0.96;
      if (p.x < lo || p.x > hi) return;
    }
    out.push({
      color: opts.color ?? 0,
      base: opts.base ?? 0.0052,
      c0: opts.c0 ?? 0.3,
      c1: opts.c1 ?? 0.38,
      lift: opts.lift ?? 0,
      mvX: opts.mvX ?? 0,
      mvY: opts.mvY ?? 0,
      onlyAfter: opts.onlyAfter ?? false,
      cool: opts.cool ?? false,
      pts,
    });
  }

  private buildWorld(rnd: () => number): void {
    const w = this.trs;
    const jr = 0.012;

    const arcPts = (
      tx: number,
      ty: number,
      r: number,
      a0: number,
      a1: number,
      n: number
    ): PtF[] => {
      const out: PtF[] = [];
      for (let i = 0; i <= n; i++) {
        const a = lerp(a0, a1, i / n);
        out.push({ x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r * 0.9 });
      }
      return out;
    };

    // -- the first tiny mark on an almost clean vessel (10-15%) ------------
    this.pushTrace(
      {
        color: 2,
        base: 0.0038,
        jit: 0.0018,
        c0: 0.035,
        c1: 0.1,
        pts: arcPts(0.5, 0.35, 0.088, TAU * 0.86, TAU * 0.945, 5),
      },
      rnd,
      w
    );

    // -- curvature nerves (15-40%): long lines following the belly ---------
    const nerve = (
      startU: number,
      t0: number,
      t1: number,
      bulge: number,
      parity: number
    ): void => {
      const pts: PtF[] = [];
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const tt = lerp(t0, t1, k);
        const uu =
          startU + Math.sin(k * Math.PI) * bulge + Math.sin(k * TAU * 2) * 0.018;
        pts.push(surfacePt(tt, uu));
      }
      this.pushTrace(
        { pts, color: parity === 0 ? 1 : 0, base: 0.0042, jit: 0.0024, c0: 0.15, c1: 0.24 },
        rnd,
        w
      );
    };
    nerve(-0.5, 0.78, 0.14, -0.12, 1);
    nerve(0.42, 0.76, 0.18, 0.16, 0);
    nerve(0.05, 0.68, 0.16, -0.06, 0);

    // -- the small branch (lower-left, remembers a garden) ------------------
    const branch: PtF[] = [
      surfacePt(0.82, -0.62),
      surfacePt(0.74, -0.42),
      surfacePt(0.68, -0.2),
      surfacePt(0.63, -0.02 + (rnd() - 0.5) * 0.015),
    ];
    branch.push({ x: branch[3].x + 0.018, y: branch[3].y - 0.045 });
    this.pushTrace(
      { pts: branch, color: 0, base: 0.0058, jit: 0.0026, c0: 0.3, c1: 0.41 },
      rnd,
      w
    );
    // a twig
    this.pushTrace(
      {
        pts: [surfacePt(0.7, -0.34), surfacePt(0.77, -0.52)],
        color: 1,
        base: 0.004,
        c0: 0.32,
        c1: 0.43,
      },
      rnd,
      w
    );
    // the little leaf — lifts off the surface at the signature moment
    this.pushTrace(
      {
        pts: [
          surfacePt(0.585 + (rnd() - 0.5) * 0.008, -0.03),
          surfacePt(0.585, -0.02),
          surfacePt(0.6, -0.012),
          surfacePt(0.605, 0.0),
          surfacePt(0.59, 0.006),
        ],
        color: 1,
        base: 0.0042,
        jit: 0.002,
        lift: 0.018,
        c0: 0.34,
        c1: 0.44,
      },
      rnd,
      w
    );

    // -- the window (a small round porthole, remembers a home) --------------
    const winT = 0.52;
    const winU = 0.42;
    const winR = 0.115;
    const winC = surfacePt(winT, winU);
    this.pushTrace(
      { pts: arcPts(winC.x, winC.y, winR, 0, TAU, 14), color: 0, base: 0.0048, c0: 0.36, c1: 0.46 },
      rnd,
      w
    );
    this.pushTrace(
      {
        pts: [
          { x: winC.x - winR * 0.82, y: winC.y },
          { x: winC.x + winR * 0.82, y: winC.y },
        ],
        color: 1,
        base: 0.0038,
        c0: 0.38,
        c1: 0.48,
      },
      rnd,
      w
    );
    this.pushTrace(
      {
        pts: [
          { x: winC.x, y: winC.y - winR * 0.82 },
          { x: winC.x, y: winC.y + winR * 0.82 },
        ],
        color: 1,
        base: 0.0038,
        c0: 0.38,
        c1: 0.48,
      },
      rnd,
      w
    );
    // variant: the window imagines opening
    this.pushTrace(
      {
        pts: [
          { x: winC.x - winR * 0.55, y: winC.y - winR * 0.32 },
          { x: winC.x + winR * 0.24, y: winC.y - winR * 0.44 },
          { x: winC.x + winR * 0.4, y: winC.y + winR * 0.12 },
        ],
        color: 0,
        base: 0.004,
        c0: 0.75,
        c1: 0.82,
        onlyAfter: true,
      },
      rnd,
      w
    );

    // -- the crescent moon (remembers a night) ------------------------------
    const moX = 0.5;
    const moY = 0.3;
    this.pushTrace(
{ pts: arcPts(moX, moY, 0.075, TAU * 0.13, TAU * 0.6, 7), color: 0, base: 0.0044, c0: 0.39, c1: 0.47,
           mvY: -0.02, mvX: 0.03 },
      rnd,
      w
    );
    this.pushTrace(
      { pts: arcPts(moX + 0.02, moY + 0.004, 0.082, TAU * 0.62, TAU * 0.99, 7), color: 0, base: 0.0044, c0: 0.39, c1: 0.47, mvY: -0.02, mvX: 0.03 },
      rnd,
      w
    );
    // cool accent fragment (the single bluish nuance in the whole scene)
    this.pushTrace(
      {
        pts: [{ x: moX - 0.05 + (rnd() - 0.5) * jr, y: moY - 0.085 }, { x: moX - 0.047, y: moY - 0.082 }],
        color: 1,
        base: 0.0038,
        cool: true,
        c0: 0.42,
        c1: 0.5,
      },
      rnd,
      w
    );

    // -- tiny fragments (seeds of memories) ---------------------------------
    const frag = (fpx: number, fpy: number, lift = 0, c = 0): void =>
      this.pushTrace(
        {
          pts: [{ x: fpx, y: fpy }, { x: fpx + 0.004, y: fpy + 0.001 }],
          color: c,
          base: 0.004,
          lift,
          jit: 0.001,
          c0: 0.44,
          c1: 0.53,
        },
        rnd,
        w
      );
    frag(0.5 + 0.1 + (rnd() - 0.5) * 0.03, 0.26 + (rnd() - 0.5) * 0.03);
    frag(0.5 - 0.16 + (rnd() - 0.5) * 0.03, 0.28 + (rnd() - 0.5) * 0.03, 0, 2);
    frag(0.5 + 0.03 + (rnd() - 0.5) * 0.03, 0.42 + (rnd() - 0.5) * 0.03, 0.014, 1);
    frag(0.5 + 0.18 + (rnd() - 0.5) * 0.02, 0.52 + (rnd() - 0.5) * 0.02, 0, 2);
    frag(0.5 - 0.2 + (rnd() - 0.5) * 0.02, 0.5 + (rnd() - 0.5) * 0.02, 0.012, 1);

    // nervous little hatch near the base (a barely-told story)
    this.pushTrace(
      {
        pts: [surfacePt(0.12, 0.62), surfacePt(0.12, 0.66), surfacePt(0.1, 0.7)],
        color: 2,
        base: 0.0036,
        c0: 0.46,
        c1: 0.55,
      },
      rnd,
      w
    );

    // normalise construction windows with a little per-cycle jitter
    const order = w.slice();
    order.sort((a, b) => a.c0 - b.c0);
    let running = 0.155;
    for (const st of order) {
      if (st.c0 >= 0.9) continue; // onlyAfter variant strokes keep their slots
      st.c0 = running + rnd() * 0.03;
      st.c1 = st.c0 + 0.045 + rnd() * 0.04;
      running = st.c1;
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

    this.pc.x += (this.pt.x - this.pc.x) * 0.06;
    this.pc.y += (this.pt.y - this.pc.y) * 0.06;

    const u = (this.t % CYCLE_SECONDS) / CYCLE_SECONDS;
    this.drawScene(u, this.t, true);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Reduced-motion: the completed memory, static. */
  private still(): void {
    this.drawScene(0.55, 14, false);
  }

  /** Paused back face: current page, frozen. */
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

    const memK =
      smoothstep(smooth(0.4, 0.48, u)) * (1 - smoothstep(smooth(0.905, 0.965, u)));
    const liftK =
      smoothstep(smooth(0.6, 0.66, u)) * (1 - smoothstep(smooth(0.7, 0.75, u)));
    const transformK = smoothstep(smooth(0.75, 0.82, u));
    const eraseK = smoothstep(smooth(0.9, 0.97, u));
    const livingW = smoothstep(smooth(0.48, 0.55, u)) * (1 - smoothstep(smooth(0.75, 0.82, u)));

    const px = (this.pc.x - 0.5) * md * 0.014 * dyn;
    const py = (this.pc.y - 0.5) * md * 0.014 * dyn;

    // ---- background ---------------------------------------------------------
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.bgGrad ?? BG_MID;
    ctx.fillRect(0, 0, pw, ph);
    if (this.vignGrad) {
      ctx.fillStyle = this.vignGrad;
      ctx.fillRect(0, 0, pw, ph);
    }

    ctx.save();
    ctx.translate(px, py);

    // soft cast shadow
    if (this.shadowGrad) {
      ctx.fillStyle = this.shadowGrad;
      ctx.beginPath();
      ctx.ellipse(AXIS * pw, ph * 0.87, pw * 0.19, ph * 0.075, 0, 0, TAU);
      ctx.fill();
    }

    // ---- the porcelain vessel ----------------------------------------------
    const yTop = Y_TOP * ph;
    const yBot = Y_BOT * ph;
    const cx = AXIS * pw;

    // silhouette: sample both sides
    const RIGHT: PtF[] = [];
    const LEFT: PtF[] = [];
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const tV = 1 - i / N;
      RIGHT.push({ x: cx + WR(tV) * pw, y: yBot - tV * (yBot - yTop) });
    }
    for (let i = 0; i <= N; i++) {
      const tV = i / N;
      LEFT.push({ x: cx - WL(tV) * pw, y: yBot - tV * (yBot - yTop) });
    }

    const tracePath = (): void => {
      ctx.beginPath();
      ctx.moveTo(RIGHT[0].x, RIGHT[0].y);
      for (let i = 1; i < RIGHT.length; i++) ctx.lineTo(RIGHT[i].x, RIGHT[i].y);
      for (let i = 1; i < LEFT.length; i++) ctx.lineTo(LEFT[i].x, LEFT[i].y);
      ctx.closePath();
    };

    ctx.save();
    tracePath();
    ctx.clip();
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.porcelainGrad ?? "#e9dfc6";
    ctx.fill();
    if (this.occGrad) {
      ctx.fillStyle = this.occGrad;
      ctx.fillRect(cx - pw * 0.3, yTop - ph * 0.02, pw * 0.66, ph * 0.68);
    }
    // gentle vertical matière: two near-invisible bands
    const bandA = ctx.createLinearGradient(0, yTop, 0, yBot);
    bandA.addColorStop(0, "rgba(255,255,255,0.10)");
    bandA.addColorStop(0.5, "rgba(255,255,255,0)");
    bandA.addColorStop(1, "rgba(96,84,66,0.10)");
    ctx.fillStyle = bandA;
    ctx.fillRect(cx - pw * 0.35, yTop, pw * 0.7, yBot - yTop);
    ctx.restore();

    // far occlusion line (right edge, matte ceramic roll-off)
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(RIGHT[0].x, RIGHT[0].y);
    for (let i = 1; i < RIGHT.length; i++) ctx.lineTo(RIGHT[i].x, RIGHT[i].y);
    ctx.strokeStyle = OCCLUDE_FAR;
    ctx.lineWidth = md * 0.028;
    ctx.stroke();
    ctx.strokeStyle = OCCLUDE_NEAR;
    ctx.lineWidth = md * 0.011;
    ctx.stroke();

    // left shoulder highlight
    ctx.beginPath();
    ctx.moveTo(LEFT[0].x, LEFT[0].y);
    for (let i = 1; i < LEFT.length; i++) ctx.lineTo(LEFT[i].x, LEFT[i].y);
    ctx.strokeStyle = HIGHLIGHT;
    ctx.lineWidth = md * 0.006;
    ctx.stroke();

    // the mouth: a soft ellipse opening at the top
    ctx.beginPath();
    ctx.ellipse(cx, yTop + md * 0.012, pw * WL(1) * 0.86, md * 0.02, 0, 0, TAU);
    ctx.fillStyle = MOUTH_IN;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, yTop + md * 0.008, pw * WL(1) * 0.9, md * 0.009, 0, 0, TAU);
    ctx.fillStyle = "rgba(255,251,240,0.4)";
    ctx.fill();

    // a barely-there cool sheen on the shoulder (porcelain, not glass)
    ctx.beginPath();
    ctx.moveTo(cx + WR(0.78) * pw * 0.9, yTop + (1 - 0.78) * (yBot - yTop));
    ctx.quadraticCurveTo(
      cx + WR(0.6) * pw * 1.04,
      yTop + (1 - 0.6) * (yBot - yTop),
      cx + WR(0.4) * pw * 0.82,
      yTop + (1 - 0.4) * (yBot - yTop)
    );
    ctx.strokeStyle = "rgba(176,190,205,0.12)";
    ctx.lineWidth = md * 0.007;
    ctx.stroke();

    // ---- memories (traces on the surface) ----------------------------------
    const flut = 1 + 0.045 * livingW * dyn * Math.sin(t * 0.6 + 1.3);
    const ptK = (this.pc.x - 0.5) * dyn; // pointer drift influence, tiny
    const ptL = (this.pc.y - 0.5) * dyn;

    for (const st of this.trs) {
      const g = smoothstep(clamp01((u - st.c0) / Math.max(0.0001, st.c1 - st.c0)));
      if (g <= 0.001) continue;

      const n = st.pts.length;
      const cov = (n - 1) * g;
      const full = Math.floor(cov);
      const frac = cov - full;

      let alphaMul = memK * flut * (1 - eraseK * 0.97);
      if (st.onlyAfter) alphaMul *= transformK;
      else alphaMul *= 1 - transformK * 0.12; // the variant lets the base settle

      const oX =
        st.mvX * transformK * pw + ptK * md * (0.003 + st.lift * 0.05) * liftK;
      const oY =
        st.mvY * transformK * ph +
        ptL * md * (0.003 + st.lift * 0.05) * liftK +
        (st.lift > 0 ? -liftK * st.lift * md : 0) +
        (st.lift > 0 ? liftK * Math.sin(t * 3 + st.c0 * 40) * md * 0.0016 : 0);

      for (let i = 1; i < n && i <= full + 1; i++) {
        const p = st.pts[i];
        const q = st.pts[i - 1];

        const x1 = q.x * pw + q.jx * md + oX;
        const y1 = q.y * ph + q.jy * md + oY;
        const x2 = p.x * pw + p.jx * md + oX;
        const y2 = p.y * ph + p.jy * md + oY;

        let alpha = q.a * (st.cool ? 0.5 : TRACE_A[st.color]);
        if (i === full + 1 && full < n - 1) alpha *= frac;
        alpha *= alphaMul;
        if (alpha <= 0.004) continue;

        // faint shadow cast by the lifted fragment onto the porcelain
        if (st.lift > 0 && liftK > 0.01) {
          ctx.globalAlpha = alpha * 0.22 * liftK;
          ctx.strokeStyle = "rgba(70,60,48,0.6)";
          ctx.lineWidth = Math.max(0.5, st.base * md * p.w) * 1.25;
          ctx.beginPath();
          ctx.moveTo(x1 + md * 0.005, y1 + md * 0.007);
          ctx.lineTo(x2 + md * 0.005, y2 + md * 0.007);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.strokeStyle = st.cool ? COOL_ACCENT : TRACE[st.color] + alpha.toFixed(4) + ")";
        ctx.lineWidth = Math.max(0.5, st.base * md * p.w);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

export const porcelainMemoryAnimation: VersoAnimationDefinition = {
  id: "porcelain_memory",
  create: () => new PorcelainMemoryScene(),
};