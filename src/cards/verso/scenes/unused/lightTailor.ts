import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../../types";

// ---------------------------------------------------------------------------
// light_tailor — the tailor of light ("atelier" verso, #2)
//
// Concept:
//   Out of a dark atelier, a raw lump of luminous matter apparels itself.
//   Golden threads wrap around it, pin it along its future outline and
//   slowly *cut* it — the lump is carved into a slender, handcrafted vessel
//   of light. A short reveal (rim, seams, soft halo), then the piece
//   loosens into drifting motes and the atelier starts a new piece.
//
// Cycle (t in seconds, one pass = CYCLE_SECONDS):
//   0-15%   matter apparels (a warm blush in the dark)
//   15-35%  first threads lace around the lump, needle-sparks travel
//   35-72%  the threads cut: the lump is sculpted toward its silhouette
//   60-75%  the silhouette sets (rim + luminous seams appear)
//   75-88%  reveal: edges brighten, a soft halo breathes
//   88-100% dissolution into motes, then a new vessel is cut
//
// Pointer: light parallax of the whole composition + a subtle bend of the
// threads toward the pointer. Single RAF while active, none while inactive
// or reduced-motion. Reduced-motion renders the final composition, static.
// ---------------------------------------------------------------------------

const CYCLE_SECONDS = 18;
const DPR_MAX = 2;
const N = 96; // contour samples (NH per side)
const NH = N >> 1;
const NPTS = 2 * (NH + 1);
const TAU = Math.PI * 2;

// Warm atelier palette (deep indigo workshop, ivory/amber light).
const BG_TOP = "#151124";
const BG_MID = "#0d0a17";
const BG_DEEP = "#060509";
const HALO_C = "rgba(232,186,122,0.55)";
const HALO_M = "rgba(232,186,122,0.15)";
const HALO_0 = "rgba(232,186,122,0)";
const CORE = "rgba(255,243,210,0.92)";
const MID = "rgba(236,201,133,0.38)";
const EDGE = "#f2d9a6";
const EDGE_BRIGHT = "#fff6de";
const SEAM = "rgba(255,245,214,1)";
const THREAD_A = "rgba(226,178,104,";
const THREAD_HOT = "rgba(255,243,208,";
const MOTES = "rgba(255,238,200,";

/** Slim handcrafted vessel: normalized outline width (1 = belly) vs v ∈ [-1..1]. */
const VESSEL_KNOTS: readonly (readonly [number, number])[] = [
  [-1, 0.1],
  [-0.85, 0.18],
  [-0.45, 0.5],
  [0, 1.0],
  [0.3, 0.72],
  [0.72, 0.14],
  [1, 0.1],
];

/** The raw lump it is cut from: a broad organic oval. */
const BLOB_KNOTS: readonly (readonly [number, number])[] = [
  [-1, 1.0],
  [-0.5, 1.04],
  [0, 1.08],
  [0.5, 1.04],
  [1, 1.0],
];

interface Station {
  readonly v: number;
  readonly hw: number;
  readonly s: 1 | -1;
}

/** Where the tailor's threads bite into the outline (v-position on either side). */
const STATIONS: readonly Station[] = [
  { v: 0.66, hw: 0.1, s: 1 },
  { v: 0.36, hw: 0.1, s: 1 },
  { v: 0.12, hw: 0.12, s: 1 },
  { v: -0.28, hw: 0.11, s: -1 },
  { v: -0.52, hw: 0.1, s: -1 },
  { v: 0.04, hw: 0.12, s: -1 },
];

interface Mote {
  readonly v: number;
  readonly s: 1 | -1;
  readonly dir: number;
  readonly dist: number;
  readonly size: number;
  readonly pulse: number;
  readonly phase: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number): number =>
  clamp01((x - a) / (b - a));
const smoothstep = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

function catmullStep(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/** Deterministic PRNG so each cycle cuts a slightly different vessel. */
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

class LightTailorScene implements VersoScene {
  readonly id = "light_tailor";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private active = false;
  private reduced = false;
  private pw = 0;
  private ph = 0;
  private W = 0; // belly half-width, px
  private HV = 0; // half-height, px
  private t = 0;
  private lastTime = 0;
  private cycleIndex = -1;

  private bgGrad: CanvasGradient | null = null;
  private haloGrad: CanvasGradient | null = null;

  // Reused per-frame buffers (no per-frame allocation).
  private readonly cxBuf = new Float32Array(NPTS);
  private readonly cyBuf = new Float32Array(NPTS);
  private readonly wBuf = new Float32Array(NH + 1);

  // Pointer: target + eased value.
  private readonly pt = { x: 0.5, y: 0.5 };
  private readonly pc = { x: 0.5, y: 0.5 };

  // Per-cycle variation (the atelier does not repeat itself exactly).
  private hip = 1;
  private asym = 0.03;
  private wa = 0;
  private wb = 0;
  private wc = 0;
  private motes: Mote[] = [];

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
    const scl = Math.min(w, h);
    this.W = scl * 0.26;
    this.HV = scl * 0.3;

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
    this.bgGrad.addColorStop(1, BG_DEEP);

    const hr = scl * 0.52;
    this.haloGrad = ctx.createRadialGradient(w / 2, h / 2, scl * 0.02, w / 2, h / 2, hr);
    this.haloGrad.addColorStop(0, HALO_C);
    this.haloGrad.addColorStop(0.5, HALO_M);
    this.haloGrad.addColorStop(1, HALO_0);

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
    this.haloGrad = null;
    this.host = null;
  }

  // ---- generation -----------------------------------------------------------

  private reseed(): void {
    const rand = mulberry32((Math.random() * 0x7fffffff) | 0);
    this.hip = 0.96 + rand() * 0.08;
    this.asym = 0.02 + rand() * 0.035;
    this.wa = rand() * TAU;
    this.wb = rand() * TAU;
    this.wc = rand() * TAU;
    this.motes = [];
    for (let i = 0; i < 14; i++) {
      this.motes.push({
        v: -0.92 + rand() * 1.84,
        s: rand() < 0.5 ? 1 : -1,
        dir: (rand() - 0.5) * 0.5,
        dist: 0.09 + rand() * 0.14,
        size: 0.7 + rand() * 1.1,
        pulse: 1.6 + rand() * 2.0,
        phase: rand() * TAU,
      });
    }
  }

  /** Normalized outline width (1 = belly) of a given profile at v ∈ [-1..1]. */
  private profileW(knots: readonly (readonly [number, number])[], v: number): number {
    const n = knots.length;
    let i = 0;
    while (i < n - 2 && v > knots[i + 1][0]) i++;
    const span = knots[i + 1][0] - knots[i][0];
    const t = span === 0 ? 0 : clamp01((v - knots[i][0]) / span);
    const p0 = knots[Math.max(0, i - 1)][1];
    const p1 = knots[i][1];
    const p2 = knots[i + 1][1];
    const p3 = knots[Math.min(n - 1, i + 2)][1];
    return Math.max(0.05, catmullStep(p0, p1, p2, p3, t));
  }

  private vIdx(v: number): number {
    return Math.min(NH, Math.max(0, Math.round(((1 - v) / 2) * NH)));
  }

  // ---- animation -------------------------------------------------------------

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

    this.pc.x += (this.pt.x - this.pc.x) * 0.08;
    this.pc.y += (this.pt.y - this.pc.y) * 0.08;

    const u = (this.t % CYCLE_SECONDS) / CYCLE_SECONDS;
    this.drawScene(u, this.t, true);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Reduced-motion / static final composition (reveal state, no movement). */
  private still(): void {
    this.drawScene(0.8, 12, false);
  }

  /** Paused back face: keep the last state visible, frozen. */
  private freeze(): void {
    this.drawScene((this.t % CYCLE_SECONDS) / CYCLE_SECONDS, this.t, false);
  }

  // ---- rendering -------------------------------------------------------------

  private drawScene(u: number, t: number, live: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;

    const matterIn = smoothstep(smooth(0, 0.15, u));
    const threadsIn = smoothstep(smooth(0.15, 0.35, u));
    const cut = smoothstep(smooth(0.3, 0.72, u));
    const define = smoothstep(smooth(0.6, 0.75, u));
    const reveal = smoothstep(smooth(0.75, 0.88, u));
    const dissolve = smoothstep(smooth(0.88, 1, u));
    const fade = 1 - dissolve;

    const PW = this.pw;
    const PH = this.ph;
    const cx = PW * 0.5 + (this.pc.x - 0.5) * PW * 0.012;
    const cy = PH * 0.52 + (this.pc.y - 0.5) * PH * 0.012;
    const W = this.W;
    const HV = this.HV;
    const organAmp = live ? 1 : 0;

    // Background and breathing halo behind the piece.
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.bgGrad ?? BG_DEEP;
    ctx.fillRect(0, 0, PW, PH);
    if (this.haloGrad) {
      ctx.globalAlpha = (0.14 * matterIn + 0.5 * reveal) * fade;
      ctx.fillStyle = this.haloGrad;
      ctx.fillRect(0, 0, PW, PH);
    }

    // The current outline: the raw lump being cut into the vessel.
    const eCut = smoothstep(cut);
    for (let k = 0; k <= NH; k++) {
      const v = 1 - (k / NH) * 2;
      const blob = this.profileW(BLOB_KNOTS, v);
      const vessel =
        this.profileW(VESSEL_KNOTS, v) *
        (1 + this.asym * Math.sin(v * 2.6));
      const organ =
        (1 - cut) *
        (0.06 * Math.sin(3 * Math.PI * v + t * 0.55 + this.wa) +
          0.045 * Math.sin(5 * Math.PI * v - t * 0.34 + this.wb)) +
        0.012 * Math.sin(2 * Math.PI * v + t * 0.8 + this.wc);
      const w = lerp(blob, vessel * this.hip, eCut) * (1 + organ * organAmp);
      this.wBuf[k] = w;
      const x = W * w;
      const y = HV * v;
      this.cxBuf[k] = cx + x;
      this.cyBuf[k] = cy - y;
      this.cxBuf[NH + 1 + k] = cx - x;
      this.cyBuf[NH + 1 + k] = cy - y;
    }

    const base = NH + 1;

    // The luminous lump itself (morphing body of light).
    const matGrad = ctx.createRadialGradient(cx, cy, W * 0.1, cx, cy, HV * 1.15);
    matGrad.addColorStop(0, CORE);
    matGrad.addColorStop(0.55, MID);
    matGrad.addColorStop(1, "rgba(236,201,133,0)");
    ctx.beginPath();
    ctx.moveTo(this.cxBuf[0], this.cyBuf[0]);
    for (let k = 1; k <= NH; k++) ctx.lineTo(this.cxBuf[k], this.cyBuf[k]);
    for (let k = 0; k <= NH; k++) {
      ctx.lineTo(this.cxBuf[base + k], this.cyBuf[base + k]);
    }
    ctx.closePath();
    ctx.globalAlpha = (0.5 * matterIn + 0.28 * define) * fade;
    ctx.fillStyle = matGrad;
    ctx.fill();

    // Inner glass: a tightened luminous core that shows the volume is hollow.
    ctx.beginPath();
    const g = 0.5 * define;
    for (let k = 0; k <= NH; k++) {
      const v = 1 - (k / NH) * 2;
      const w = this.wBuf[k] * g;
      const px = cx + W * w;
      const py = cy - HV * v * 0.92;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let k = 0; k <= NH; k++) {
      const v = 1 - (k / NH) * 2;
      const w = this.wBuf[k] * g;
      const px = cx - W * w;
      const py = cy - HV * v * 0.92;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.globalAlpha = (0.08 + 0.18 * define + 0.2 * reveal) * fade;
    ctx.fillStyle = EDGE_BRIGHT;
    ctx.fill();

    // The cut rim (the vessel's mouth) once the piece is defined.
    if (define > 0) {
      const rx = W * 0.1;
      const ry = HV * 0.035;
      ctx.globalAlpha = define * (0.35 + 0.4 * reveal) * fade;
      ctx.strokeStyle = EDGE;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(cx, cy - HV, rx, ry, 0, 0, TAU);
      ctx.stroke();
    }

    // Luminous seam: a sheen catching the light on the vessel's belly.
    if (define > 0 && reveal > 0) {
      ctx.globalAlpha = define * (0.3 + 0.6 * reveal) * fade;
      ctx.strokeStyle = SEAM;
      ctx.lineCap = "round";
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx + W * 0.09, cy - HV * 0.92);
      ctx.quadraticCurveTo(cx + W * 0.6, cy - HV * 0.15, cx + W * 0.08, cy + HV * 0.42);
      ctx.stroke();
      ctx.globalAlpha = define * reveal * 0.3 * fade;
      ctx.lineWidth = 2.4;
      ctx.stroke();
    }

    // The silhouette edge: gains light as it is revealed.
    const edgeA = (0.14 + 0.55 * reveal) * fade;
    ctx.globalAlpha = edgeA;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(this.cxBuf[0], this.cyBuf[0]);
    for (let k = 1; k <= NH; k++) ctx.lineTo(this.cxBuf[k], this.cyBuf[k]);
    for (let k = 0; k <= NH; k++) {
      ctx.lineTo(this.cxBuf[base + k], this.cyBuf[base + k]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = reveal * 0.14 * fade;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.globalAlpha = (0.18 + 0.62 * reveal) * fade;
    ctx.strokeStyle = EDGE_BRIGHT;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // Trailing fibers: two long threads escaping the atelier bench.
    const fibers: readonly (readonly [number, 1 | -1])[] = [
      [0.34, 1],
      [-0.5, -1],
    ];
    ctx.lineCap = "round";
    ctx.strokeStyle = THREAD_A + "0.55)";
    for (const [fv, fs] of fibers) {
      const k = this.vIdx(fv);
      const w = this.wBuf[k];
      const x0 = cx + fs * W * w;
      const y0 = cy - HV * fv;
      const sway = live ? Math.sin(t * 0.4 + fv * 3) * 2 : 0;
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = threadsIn * 0.07 * fade;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(
        x0 + fs * W * 0.9,
        y0 - fs * 6 + sway,
        x0 + fs * W * 1.35,
        y0 + fs * 12 - sway * 0.5
      );
      ctx.stroke();
    }

    // The tailor's threads: basting stitches pinned along the outline,
    // offset outward while the cut is still in progress, subtly bent toward
    // the pointer through a small v-shift of the work.
    const bend = 0.04 * (this.pc.x - 0.5);
    for (const st of STATIONS) {
      const bv = st.v + bend * 0.6;
      const a0 = bv - st.hw;
      const a1 = bv + st.hw;
      const k0 = this.vIdx(a0);
      const k1 = this.vIdx(a1);
      const offset = (1 - define) * 2.4;
      const threadA = threadsIn * (0.3 + 0.4 * reveal) * (1 - dissolve) * (1 - cut * 0.12);
      const hotA = threadA * 0.9;
      this.traceThread(threadA, k0, k1, st.s, offset + 0.1);
      this.traceThread(hotA, k0, k1, st.s, offset * 0.6);
      if (live && threadsIn > 0 && dissolve < 0.9) {
        const s = (t / 3.1 + st.v * 4 + this.wa) % 1;
        const sv = a0 + s * (a1 - a0);
        const k = this.vIdx(sv);
        const x = cx + st.s * W * this.wBuf[k];
        const y = cy - HV * sv;
        ctx.globalAlpha = threadA * 1.5;
        ctx.fillStyle = THREAD_HOT + "0.9)";
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = threadA * 2.2;
        ctx.fillStyle = "#fff9e6";
        ctx.beginPath();
        ctx.arc(x, y, 0.9, 0, TAU);
        ctx.fill();
      }
    }

    // Dissolution motes: the piece lets go of its material.
    if (live) {
      const move = smoothstep(smooth(0.88, 0.94, u));
      const fading = 1 - smoothstep(smooth(0.965, 1, u));
      if (move > 0 && fading > 0) {
        ctx.fillStyle = MOTES + "0.9)";
        for (const mote of this.motes) {
          const k = this.vIdx(mote.v);
          const w = this.wBuf[k];
          const sx = cx + mote.s * W * w;
          const sy = cy - HV * mote.v;
          // Outward from the silhouette point, with a personal scatter.
          const ang = Math.atan2(-mote.v * HV, mote.s * W * w) + mote.dir;
          const d = move * mote.dist * this.scl();
          const mx = sx + Math.cos(ang) * d;
          const my = sy + Math.sin(ang) * d;
          const tw = 0.5 + 0.5 * Math.sin(t * mote.pulse + mote.phase);
          ctx.globalAlpha = move * fading * (0.22 + 0.42 * tw);
          ctx.beginPath();
          ctx.arc(mx, my, mote.size, 0, TAU);
          ctx.fill();
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  private scl(): number {
    return Math.min(this.pw, this.ph);
  }

  private traceThread(alpha: number, k0: number, k1: number, s: 1 | -1, offset: number): void {
    const ctx = this.ctx;
    if (!ctx || alpha <= 0 || k0 > k1) return;
    const base = NH + 1;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = alpha > 0.4 ? THREAD_HOT + "0.95)" : THREAD_A + "0.8)";
    ctx.lineWidth = s > 0 ? 1.15 : 0.85;
    ctx.beginPath();
    for (let k = k0; k <= k1; k++) {
      const idx = s > 0 ? k : base + k;
      const x = this.cxBuf[idx] + (s > 0 ? offset : -offset);
      const y = this.cyBuf[idx];
      if (k === k0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

export const lightTailorAnimation: VersoAnimationDefinition = {
  id: "light_tailor",
  create: () => new LightTailorScene(),
};