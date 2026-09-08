import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../types";

// ---------------------------------------------------------------------------
// floating_watercolor — watercolor in weightlessness
//
// A small drop of pigment hovers on almost-white ivory paper. It stretches,
// separates into a few fluid veils, and the veils drift into an abstract
// composition (suggesting a wing, a wave, an impossible landscape — never a
// literal object). The pigments gently approach each other, their overlaps
// deepen into a true watercolor mix, and the whole painting hangs there,
// weightless, barely breathing, before the veils return to the centre and
// reform into a single drop.
//
// The matière never falls. The veils are continuous organic masses (never
// particles): irregular controlled edges, progressive transparency, layered
// washes whose overlaps genuinely accumulate and deepen (source-over glazing
// on the ivory sheet).
//
// Cycle (t in seconds, one pass = CYCLE_SECONDS):
//   0-12%   drop: a single irregular droplet of pigment at the centre
//   12-30%  stretch: the whole mass elongates along an axis
//   30-50%  separation: veils peel away, still connected by overlap
//   50-68%  composition: veils settle into an abstract arrangement, blending
//   68-78%  weightlessness: almost still, rare movement, the heroic moment
//   78-94%  return: the veils drift back and recombine
//   94-100% drop: everything is one drop again, then the cycle restarts
//
// Variation is deterministic per cycle (same identity, different dance).
// Pointer: an extremely light local disturbance of the pigment field that
// relaxes naturally when the pointer stops. Removed on destroy.
// Single RAF while active, none while inactive or reduced-motion.
// Reduced-motion: the composition at its most beautiful moment, static.
// ---------------------------------------------------------------------------

const CYCLE_SECONDS = 22;
const DPR_MAX = 2;
const TAU = Math.PI * 2;

const PAPER_STOPS = ["#e9eef2", "#e2e8ee", "#dbe1ea"] as const;
const PAPER_VIGN = "rgba(96,118,152,0.16)";
const PAPER_DIRT = [
  "rgba(148,166,190,0.055)",
  "rgba(128,148,176,0.05)",
  "rgba(160,168,184,0.05)",
];

// pigments — desaturated watercolor inks
const PIGMENTS = [
  { r: 94, g: 124, b: 158 },
  { r: 196, g: 148, b: 164 },
  { r: 190, g: 158, b: 104 },
] as const;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const smooth = (a: number, b: number, x: number): number =>
  clamp01((x - a) / (b - a));
const smoothstep = (t: number): number => {
  const v = clamp01(t);
  return v * v * (3 - 2 * v);
};
const easeOut = (s: number): number => {
  const v = clamp01(s);
  return 1 - (1 - v) * (1 - v) * (1 - v);
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

interface Veil {
  ang: number; // bearing of the resting place
  rad: number; // distance of resting place from centre, fraction of pw
  sz: number; // size multiplier
  col: number; // pigment index
  rot: number; // rotation
  elong: number; // local elongation strength
  elongAng: number; // elongation axis
  shape: readonly number[]; // N radial samples (mean ~1)
}

const N_SHAPE = 14;

class FloatingWatercolorScene implements VersoScene {
  readonly id = "floating_watercolor";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private paper: HTMLCanvasElement | null = null;
  private rafId: number | null = null;
  private active = false;
  private reduced = false;
  private pw = 0;
  private ph = 0;
  private md = 0;
  private t = 0;
  private lastTime = 0;
  private cycleIndex = -1;

  private veils: Veil[] = [];
  private elongAng = 0;

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

    // the watercolor sheet — painted once per resize, reused every frame
    const paper = document.createElement("canvas");
    paper.width = canvas.width;
    paper.height = canvas.height;
    const pctx = paper.getContext("2d");
    if (pctx) {
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const grad = pctx.createLinearGradient(0, 0, w, h);
      for (let i = 0; i < PAPER_STOPS.length; i++) {
        grad.addColorStop(i / (PAPER_STOPS.length - 1), PAPER_STOPS[i]);
      }
      pctx.globalAlpha = 1;
      pctx.fillStyle = grad;
      pctx.fillRect(0, 0, w, h);

      // uneven, slightly darker sheet edge (never a perfect frame)
      const vg = pctx.createRadialGradient(
        w / 2, h / 2, this.md * 0.28,
        w / 2, h / 2, this.md * 0.95,
      );
      vg.addColorStop(0, "rgba(96,118,152,0)");
      vg.addColorStop(0.55, "rgba(96,118,152,0.06)");
      vg.addColorStop(1, PAPER_VIGN);
      pctx.fillStyle = vg;
      pctx.fillRect(0, 0, w, h);

      // a few almost-invisible old stains in the paper
      const dirt = mulberry32((Math.round(w) * 7919 + Math.round(h)) | 0);
      for (let i = 0; i < 5; i++) {
        const sx = (0.08 + dirt() * 0.84) * w;
        const sy = (0.08 + dirt() * 0.84) * h;
        const sr = (0.06 + dirt() * 0.1) * this.md;
        const g = pctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
        g.addColorStop(0, PAPER_DIRT[Math.floor(dirt() * PAPER_DIRT.length)]);
        g.addColorStop(1, "rgba(255,255,255,0)");
        pctx.fillStyle = g;
        pctx.beginPath();
        pctx.arc(sx, sy, sr, 0, TAU);
        pctx.fill();
      }
      this.paper = paper;
    }

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
    this.paper = null;
    this.veils = [];
    this.host = null;
  }

  // ---- generation --------------------------------------------------------------

  private reseed(): void {
    const rnd = mulberry32((Math.random() * 0x7fffffff) | 0);
    this.veils = [];
    this.elongAng = rnd() * TAU;

    const K = 5 + Math.floor(rnd() * 3); // 5..7 veils
    for (let i = 0; i < K; i++) {
      const shape: number[] = [];
      const amp = 0.08 + rnd() * 0.12;
      for (let k = 0; k < N_SHAPE; k++) {
        shape.push(1 + (rnd() - 0.5) * 2 * amp);
      }
      const roll = rnd();
      this.veils.push({
        ang: rnd() * TAU,
        rad: 0.12 + rnd() * 0.2,
        sz: 0.78 + rnd() * 0.62,
        col: roll < 0.5 ? 0 : roll < 0.85 ? 1 : 2,
        rot: rnd() * TAU,
        elong: 0.12 + rnd() * 0.28,
        elongAng: rnd() * TAU,
        shape,
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

  /** Reduced-motion: the composition at its most beautiful moment, static. */
  private still(): void {
    this.drawScene(0.72, 16, false);
  }

  /** Paused back face: current frame, frozen. */
  private freeze(): void {
    this.drawScene((this.t % CYCLE_SECONDS) / CYCLE_SECONDS, this.t, false);
  }

  // ---- rendering ---------------------------------------------------------------------

  private drawScene(u: number, t: number, live: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0 || !this.paper) return;
    const pw = this.pw;
    const ph = this.ph;
    const md = this.md;
    const dyn = live ? 1 : 0;

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(this.paper, 0, 0, pw, ph);

    const cx = pw * 0.5;
    const cy = ph * 0.48;
    const dx = (this.pc.x - 0.5) * dyn;
    const dy = (this.pc.y - 0.5) * dyn;

    // --- state of the transformation --------------------------------------------------
    const stretchK =
      smoothstep(smooth(0.12, 0.2, u)) * (1 - smoothstep(smooth(0.28, 0.36, u)));
    const eLen = md * 0.11 * stretchK;
    const Cxe = cx + Math.cos(this.elongAng) * eLen;
    const Cye = cy + Math.sin(this.elongAng) * eLen;

    // veils converge slightly and deepen during the composed moment (blend)
    const compW =
      smoothstep(smooth(0.5, 0.58, u)) * (1 - smoothstep(smooth(0.94, 0.985, u)));
    const scBlend = 1 + compW * 0.13;
    const droopK = 1 - smoothstep(smooth(0.94, 0.985, u)); // shrink back into the drop

    // border activity: lively while separating, microscopic while suspended
    const alive =
      smoothstep(smooth(0.3, 0.42, u)) * (1 - smoothstep(smooth(0.94, 0.985, u)));

    for (let i = 0; i < this.veils.length; i++) {
      const v = this.veils[i];

      const sepS = smoothstep(smooth(0.3 + i * 0.012, 0.42 + i * 0.012, u));
      const retS = smoothstep(smooth(0.78 + i * 0.008, 0.9 + i * 0.008, u));

      // resting place (veils converge a little during the blend, deepening mix)
      const conv = 1 - compW * 0.22;
      const Px = cx + Math.cos(v.ang) * v.rad * pw * conv;
      const Py = cy + Math.sin(v.ang) * v.rad * ph * 0.92 * conv;

      // centre: shared elongated mass -> resting place -> back to the drop
      const ex = easeOut(sepS);
      const rx = easeOut(retS);
      const Vx = (lerp(Cxe, Px, ex) * (1 - rx) + Cxe * rx) + dx * md * 0.02;
      const Vy = (lerp(Cye, Py, ex) * (1 - rx) + Cye * rx) + dy * md * 0.02;

      // size: small inside the drop, full when separated, slightly larger to blend
      const breathe = 1 + 0.012 * Math.sin(t * 0.55 + i * 1.7);
      const base = v.sz * (0.55 + 0.45 * sepS) * scBlend * droopK * breathe;
      const radius =
        (0.1 + v.sz * 0.065) * md * base + Math.sin(t * 0.7 + i * 2.4) * md * 0.01;

      this.drawVeil(ctx, Vx, Vy, radius, v, t, i, alive, dx, dy);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }

  private drawVeil(
    ctx: CanvasRenderingContext2D,
    vx: number,
    vy: number,
    radius: number,
    v: Veil,
    t: number,
    i: number,
    alive: number,
    dx: number,
    dy: number,
  ): void {
    const px: number[] = [];
    const py: number[] = [];

    for (let k = 0; k < N_SHAPE; k++) {
      const th = (k / N_SHAPE) * TAU;
      // deterministic, slow, non-repeating deformation field
      const def =
        Math.sin(2 * th + t * 0.42 + i * 1.3) +
        0.7 * Math.sin(3 * th + t * 0.31 + i * 0.7) +
        0.45 * Math.sin(5 * th + t * 0.2 + i * 2.6);
      const punct = 1 + def * (0.028 + alive * 0.03);
      // gentle pointer asymmetry of the field
      const pBias = (Math.cos(th) * dx + Math.sin(th) * dy) * 0.018;
      const elong = 1 + v.elong * 0.45 * (Math.cos(2 * (th - v.elongAng)) + 1) * 0.5;

      const r = clamp01(v.shape[k]) * radius * punct * elong * (1 + pBias) * 1.15;
      const a = th + v.rot;
      px.push(vx + Math.cos(a) * r);
      py.push(vy + Math.sin(a) * r);
    }

    // gradient slightly off-centre so no wash is ever a perfect disc
    const gx = vx + Math.cos(v.rot) * radius * 0.12;
    const gy = vy + Math.sin(v.rot) * radius * 0.12;

    // three layered washes: soft outer halo, main body, denser core
    this.wash(ctx, px, py, 1.06, v.col, gx, gy, radius * 1.6, 0.1, 0.05, 0);
    this.wash(ctx, px, py, 1.0, v.col, gx, gy, radius * 1.25, 0.26, 0.15, 0.012);
    this.wash(ctx, px, py, 0.7, v.col, gx, gy, radius, 0.2, 0.1, 0);
  }

  private wash(
    ctx: CanvasRenderingContext2D,
    px: number[],
    py: number[],
    scale: number,
    colIdx: number,
    gx: number,
    gy: number,
    gMax: number,
    a0: number,
    aM: number,
    a1: number,
  ): void {
    const col = PIGMENTS[colIdx];
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(0.01, gMax));
    grad.addColorStop(0, `rgba(${col.r},${col.g},${col.b},${a0.toFixed(3)})`);
    grad.addColorStop(0.6, `rgba(${col.r},${col.g},${col.b},${aM.toFixed(3)})`);
    grad.addColorStop(1, `rgba(${col.r},${col.g},${col.b},${a1.toFixed(3)})`);

    const cx0 = (px[0] + px[1] + px[2]) / 3;
    const cy0 = (py[0] + py[1] + py[2]) / 3;

    ctx.beginPath();
    ctx.moveTo(cx0 + (px[0] - cx0) * scale, cy0 + (py[0] - cy0) * scale);
    for (let k = 1; k < px.length; k++) {
      ctx.lineTo(cx0 + (px[k] - cx0) * scale, cy0 + (py[k] - cy0) * scale);
    }
    ctx.closePath();
    ctx.globalAlpha = 1;
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

export const floatingWatercolorAnimation: VersoAnimationDefinition = {
  id: "floating_watercolor",
  create: () => new FloatingWatercolorScene(),
};