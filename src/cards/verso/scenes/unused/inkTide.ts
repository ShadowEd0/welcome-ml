// ARCHIVÉ (Mission #18) : prototype retiré du registry actif — conservé ici
// pour référence. Non importé par scenes/index.ts, donc absent du bundle.
import type {
  VersoAnimationDefinition,
  VersoScene,
  VersoSceneContext,
} from "../../types";

// ---------------------------------------------------------------------------
// "La Marée d'Encre" — first artistic production scene.
// Canvas 2D. A dark ink tide spreads organically over paper, branches into
// fine ramifications and progressively reveals a river delta.
//
// Rendering strategy (cheap + soft):
//   - a low-resolution "ink density" grid (cell ≈ 3 CSS px) with one tiny
//     BFS distance field sprung from the top source: the tide sweeps out,
//     and the matter around the river network forms a connected corridor
//     that tapers into the branches (the delta);
//   - the grid is baked to an ImageData each frame and upscaled with
//     smoothing for an organic, bleeding look;
//   - revealed river-beds and fine ramifications live inside the ink matter
//     itself (no full-resolution strokes), and a soft golden glow marks the
//     mouth of the delta.
//
// Lifecycle: one RAF while active, nothing while inactive, complete cleanup.
// Pointer: a light local current (soft ink pull) — host-bound, removed on
// destroy. Reduced-motion: the fully revealed, static composition.
// ---------------------------------------------------------------------------

// ---- palette (ink on light paper) ----
const INK_R = 34;
const INK_G = 41;
const INK_B = 51;
const PAPER_TOP = "#eee8d9";
const PAPER_MID = "#e4dac0";
const PAPER_BOTTOM = "#d8c7a3";
const VIGNETTE_TOP = "rgba(140, 114, 82, 0)";
const VIGNETTE_MID = "rgba(120, 92, 58, 0.10)";
const VIGNETTE_EDGE = "rgba(104, 79, 48, 0.22)";
const GOLD_CORE = "rgba(245, 231, 186, 0.40)";
const GOLD_MID = "rgba(222, 190, 120, 0.12)";
const GOLD_RIM = "rgba(222, 190, 120, 0)";
const FLECK = "252, 244, 222";

const CELL_PX = 3;
const GRID_MAX_W = 128;
const GRID_MAX_H = 200;
const DPR_MAX = 2;
const CYCLE_SECONDS = 40;

const SOFT_CELLS = 2.6; // wet-edge softness at the tide front (cells)
const RELAX = 0.1;
const FLEET_COUNT = 6;

interface LinePt {
  readonly x: number;
  readonly y: number;
}
type Poly = readonly LinePt[];

const sat = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, x: number): number =>
  sat((x - a) / (b - a));
const smoothstep = (t: number): number => t * t * (3 - 2 * t);

function hash2(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 65535 / 65535;
}

function valueNoiseAt(fx: number, fy: number, gran: number): number {
  const x = fx * gran;
  const y = fy * gran;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothstep(x - x0);
  const ty = smoothstep(y - y0);
  const a = hash2(x0, y0);
  const b = hash2(x0 + 1, y0);
  const c = hash2(x0, y0 + 1);
  const d = hash2(x0 + 1, y0 + 1);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** Deterministic PRNG so each cycle grows a slightly different delta. */
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

// ---- composition in normalized [0..1]² space, generated per cycle ----

function lerpLn(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function genSkeleton(rand: () => number): { rivers: Poly[]; veins: Poly[] } {
  const rivers: Poly[] = [];

  // Main channel: pours from the top, wanders toward the center.
  const main: LinePt[] = [{ x: 0.5, y: -0.04 }];
  const mainPhase = rand() * Math.PI * 2;
  const mainN = 11;
  for (let i = 1; i <= mainN; i++) {
    const u = i / mainN;
    const bend = Math.sin(u * 6.3 + mainPhase) * 0.03 + Math.sin(u * 17.9 + mainPhase * 1.7) * 0.012;
    main.push({ x: clamp01(0.5 + bend), y: 0.04 + u * 0.32 });
  }
  rivers.push(main);

  // Distributaries: the delta fan, each with its own wander.
  const branches = 3 + (rand() < 0.5 ? 1 : 0);
  for (let k = 0; k < branches; k++) {
    const xEnd = 0.16 + (k / (branches - 1 > 0 ? branches - 1 : 1)) * 0.72 + (rand() - 0.5) * 0.06;
    const yEnd = clamp01(0.7 + (k % 2) * 0.16 + (rand() - 0.5) * 0.05);
    const phase = rand() * Math.PI * 2;
    const amp = 0.026 + rand() * 0.02;
    const n = 9;
    const pts: LinePt[] = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = clamp01(lerpLn(0.5, Math.max(0.06, xEnd), u) + Math.sin(u * 6.3 + phase) * amp);
      const y = clamp01(lerpLn(0.36, yEnd, u) + Math.sin(u * 11.5 + phase * 1.9) * 0.012);
      pts.push({ x, y });
    }
    rivers.push(pts);

    // Fingertips: short delicate extensions from each branch end.
    const tips = 1 + Math.floor(rand() * 2);
    for (let t = 0; t < tips; t++) {
      const angleA = rand() * Math.PI * 2;
      const len = 0.03 + rand() * 0.05;
      const sx = clamp01(pts[n].x + Math.sin(angleA) * len);
      const sy = clamp01(pts[n].y + Math.cos(angleA) * len);
      rivers.push([
        { x: clamp01(pts[n].x), y: clamp01(pts[n].y) },
        { x: sx, y: sy },
        {
          x: clamp01(sx + Math.sin(angleA + (rand() - 0.5) * 0.6) * 0.025),
          y: clamp01(sy + Math.cos(angleA + (rand() - 0.5) * 0.6) * 0.025),
        },
      ]);
    }
  }

  // Fine ramifications ("veins"): short strokes sprouting from the branches.
  const count = 9 + Math.floor(rand() * 5);
  const veins: Poly[] = [];
  for (let v = 0; v < count; v++) {
    const branch = rivers[1 + Math.floor(rand() * branches)];
    if (!branch) continue;
    const idx = Math.max(1, Math.min(branch.length - 2, Math.floor(1 + rand() * (branch.length - 2))));
    const a = branch[idx - 1];
    const b = branch[idx];
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const side = rand() < 0.5 ? -1 : 1;
    const pnx = (-dy / len) * side;
    const pny = (dx / len) * side;
    const size = 0.03 + rand() * 0.05;
    veins.push([
      { x: b.x, y: b.y },
      { x: clamp01(b.x + pnx * size * 0.55), y: clamp01(b.y + pny * size * 0.55) },
      { x: clamp01(b.x + pnx * size), y: clamp01(b.y + pny * size) },
    ]);
  }

  return { rivers, veins };
}

function paintPolylines(
  polys: Poly[],
  gw: number,
  gh: number,
  riverMask: Uint8Array | null,
  ram: Float32Array | null
): void {
  for (const poly of polys) {
    for (let s = 0; s < poly.length - 1; s++) {
      const p = poly[s];
      const q = poly[s + 1];
      if (!p || !q) continue;
      const segLen = Math.hypot((q.x - p.x) * gw, (q.y - p.y) * gh);
      const steps = Math.max(1, Math.ceil(segLen * 2));
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        const x = Math.min(gw - 1, Math.max(0, Math.round((p.x + (q.x - p.x) * u) * gw)));
        const y = Math.min(gh - 1, Math.max(0, Math.round((p.y + (q.y - p.y) * u) * gh)));
        const idx = y * gw + x;
        if (riverMask) riverMask[idx] = 1;
        if (ram) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const X = x + dx;
              const Y = y + dy;
              if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue;
              const w = Math.exp(-(dx * dx + dy * dy) * 0.8);
              const j = Y * gw + X;
              if (w > ram[j]) ram[j] = w;
            }
          }
        }
      }
    }
  }
}

/** 4-connected BFS filling `out` with distances from the seeded cells. */
function bfsDistance(
  out: Int32Array,
  seedMask: Uint8Array,
  w: number,
  h: number
): number {
  const INF = 0x3fffffff;
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  let max = 0;
  out.fill(INF);
  for (let i = 0; i < out.length; i++) {
    if (seedMask[i] !== 0) {
      out[i] = 0;
      queue[tail++] = i;
    }
  }
  const tryVisit = (next: number, d: number) => {
    if (out[next] > d) {
      out[next] = d;
      if (d > max) max = d;
      queue[tail++] = next;
    }
  };
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w;
    const cy = (cur / w) | 0;
    const d = out[cur] + 1;
    if (cx > 0) tryVisit(cur - 1, d);
    if (cx < w - 1) tryVisit(cur + 1, d);
    if (cy > 0) tryVisit(cur - w, d);
    if (cy < h - 1) tryVisit(cur + w, d);
  }
  return max;
}

interface Fleck {
  a: number;
  w: number;
  size: number;
  pulse: number;
  phase: number;
}

// ---------------------------------------------------------------------------

class InkTideScene implements VersoScene {
  readonly id = "ink_tide";

  private host: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private rafId: number | null = null;
  private active = false;
  private reduced = false;

  private pw = 0;
  private ph = 0;
  private gw = 0;
  private gh = 0;

  private paperGrad: CanvasGradient | null = null;
  private vigGrad: CanvasGradient | null = null;

  private ink: Float32Array | null = null;
  private river: Int32Array | null = null;
  private flood: Int32Array | null = null;
  private ram: Float32Array | null = null;
  private noise: Float32Array | null = null;
  private image: ImageData | null = null;
  private sim: HTMLCanvasElement | null = null;

  private rivers: Poly[] = [];
  private mouth: LinePt = { x: 0.5, y: 0.36 };
  private maxFlood = 1;

  private cycleSeed = 1;
  private cycleIndex = 0;
  private t = 0;
  private lastTime = 0;

  private revealVis = 0;

  private pointer = { x: 0.5, y: 0.5, vx: 0, vy: 0 };
  private readonly onPointerMove: (event: PointerEvent) => void;
  private flecks: Fleck[] = [];

  constructor() {
    this.onPointerMove = (event: PointerEvent) => {
      const host = this.host;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const nx = sat((event.clientX - rect.left) / rect.width);
      const ny = sat((event.clientY - rect.top) / rect.height);
      this.pointer.vx = 0.55 * this.pointer.vx + 0.45 * (nx - this.pointer.x);
      this.pointer.vy = 0.55 * this.pointer.vy + 0.45 * (ny - this.pointer.y);
      this.pointer.x = nx;
      this.pointer.y = ny;
    };
  }

  // ---- mount / resize -----------------------------------------------------

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
    this.initFlecks();
    this.reseed();
    this.resize();
    if (this.reduced) this.renderFinal();
  }

  resize(): void {
    const host = this.host;
    const canvas = this.canvas;
    if (!host || !canvas) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (w === 0 || h === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const gw0 = Math.max(8, Math.min(GRID_MAX_W, Math.floor(w / CELL_PX)));
    const gh0 = Math.max(8, Math.min(GRID_MAX_H, Math.floor(h / CELL_PX)));

    this.pw = w;
    this.ph = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);

    const changed = gw0 !== this.gw || gh0 !== this.gh;
    if (changed) {
      this.gw = gw0;
      this.gh = gh0;
      this.allocateGrid();
      this.rebuildFields();
    }
    this.rebuildDecor();

    if (this.reduced) {
      this.renderFinal();
    } else if (!this.active) {
      // A brand-new size while paused: keep the paper visible so the back is
      // never an empty void between flips.
      this.renderPaperOnly();
    }
  }

  private allocateGrid(): void {
    const n = this.gw * this.gh;
    this.ink = new Float32Array(n);
    this.river = new Int32Array(n);
    this.flood = new Int32Array(n);
    this.ram = new Float32Array(n);
    this.noise = new Float32Array(n);

    // Grain constant across cycles: value noise in two octaves.
    const n0 = this.noise;
    for (let i = 0; i < n; i++) {
      const fx = (i % this.gw) / this.gw;
      const fy = ((i / this.gw) | 0) / this.gh;
      const v1 = valueNoiseAt(fx, fy, 5);
      const v2 = valueNoiseAt(fx, fy, 11);
      n0[i] = clamp01(0.5 + (v1 * 0.65 + v2 * 0.35 - 0.5) * 1.35);
    }

    this.image = this.ctx?.createImageData(this.gw, this.gh) ?? null;
    this.sim = document.createElement("canvas");
    this.sim.width = this.gw;
    this.sim.height = this.gh;
  }

  private initFlecks(): void {
    this.flecks = [];
    for (let i = 0; i < FLEET_COUNT; i++) {
      this.flecks.push({
        a: Math.random() * Math.PI * 2,
        w: (0.15 + Math.random() * 0.45) * 0.055,
        size: 0.6 + Math.random() * 0.9,
        pulse: 2 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private reseed(): void {
    this.cycleSeed = (Math.random() * 0x7fffffff) | 0;
  }

  private rebuildFields(): void {
    const gw = this.gw;
    const gh = this.gh;
    if (gw === 0 || gh === 0) return;
    const rand = mulberry32(this.cycleSeed);
    const { rivers, veins } = genSkeleton(rand);
    this.rivers = rivers;

    const n = gw * gh;
    const riverMask = new Uint8Array(n);
    const floodMask = new Uint8Array(n);
    const ram = this.ram;
    if (ram) ram.fill(0);

    paintPolylines(rivers, gw, gh, riverMask, null);
    paintPolylines(veins, gw, gh, null, ram);

    // The tide does NOT spring from the whole skeleton (that would confine
    // the ink to an outline of channels). It springs from a single source
    // disc near the top edge: one connected sheet that then fans out.
    const cx0 = gw * 0.5;
    const cy0 = gh * 0.03;
    for (let i = 0; i < n; i++) {
      const gx = i % gw;
      const gy = (i / gw) | 0;
      const dx = (gx - cx0) / (gw * 0.2);
      const dy = (gy - cy0) / (gh * 0.16);
      if (dx * dx + dy * dy <= 1) floodMask[i] = 1;
    }

    if (this.river) bfsDistance(this.river, riverMask, gw, gh);
    if (this.flood) this.maxFlood = bfsDistance(this.flood, floodMask, gw, gh);

    // The mouth of the delta = where the main channel ends and the fan opens.
    const main = this.rivers[0];
    const end = main ? main[main.length - 1] : null;
    this.mouth = end ? { x: end.x, y: end.y } : { x: 0.5, y: 0.36 };
  }

  private rebuildDecor(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    const pw = this.pw;
    const ph = this.ph;
    this.paperGrad = ctx.createLinearGradient(0, 0, 0, ph);
    this.paperGrad.addColorStop(0, PAPER_TOP);
    this.paperGrad.addColorStop(0.5, PAPER_MID);
    this.paperGrad.addColorStop(1, PAPER_BOTTOM);
    const r = Math.min(pw, ph) * 0.78;
    this.vigGrad = ctx.createRadialGradient(pw / 2, ph / 2, r * 0.38, pw / 2, ph / 2, r * 1.6);
    this.vigGrad.addColorStop(0, VIGNETTE_TOP);
    this.vigGrad.addColorStop(0.55, VIGNETTE_MID);
    this.vigGrad.addColorStop(1, VIGNETTE_EDGE);
  }

  // ---- lifecycle ------------------------------------------------------------

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
      this.renderFinal();
    } else if (this.active && this.rafId === null) {
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.frame);
    }
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
    this.sim?.remove();
    this.canvas = null;
    this.ctx = null;
    this.sim = null;
    this.ink = null;
    this.river = null;
    this.flood = null;
    this.ram = null;
    this.noise = null;
    this.image = null;
    this.paperGrad = null;
    this.vigGrad = null;
    this.host = null;
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
      this.rebuildFields();
    }

    this.simulate(false);
    this.bakeRaster();
    this.renderFrame();
    this.rafId = requestAnimationFrame(this.frame);
  };

  private phaseF(): number {
    const p = this.t % CYCLE_SECONDS;
    return p / CYCLE_SECONDS;
  }
  private readonly frontFor = (p: number): number =>
    p < 0.55 ? 0.06 + (p / 0.55) * 0.94 : 1;
  private readonly revealFor = (p: number): number => (p < 0.42 ? 0 : smooth(0.42, 0.74, p));
  private readonly ramInFor = (p: number): number => (p < 0.3 ? 0 : smooth(0.3, 0.56, p));
  private readonly fadeFor = (p: number): number =>
    p >= 0.94 ? 1 - smooth(0.94, 1, p) : p <= 0.05 ? smooth(0, 0.05, p) : 1;

  private simulate(hard: boolean): void {
    const ink = this.ink;
    const flood = this.flood;
    if (!ink || !flood) return;
    const gw = this.gw;
    const gh = this.gh;
    const maxF = this.maxFlood;
    if (maxF <= 0 || gw === 0 || gh === 0) return;

    const p = this.phaseF();
    const front = this.frontFor(p);
    const reveal = this.revealFor(p);
    const ramIn = this.ramInFor(p);
    const fade = this.fadeFor(p);
    this.revealVis = reveal;

    const n = gw * gh;
    const frontCut = front * maxF;
    for (let i = 0; i < n; i++) {
      const f = flood[i];
      if (f > frontCut + SOFT_CELLS) {
        ink[i] *= 0.82;
        continue;
      }
      const target = this.inkAt(i, front, reveal, ramIn, fade);
      ink[i] = hard ? target : ink[i] + (target - ink[i]) * RELAX;
    }
  }

  /**
   * Target ink density at grid cell `i`. One connected sheet: a soft source
   * pool at the top edge pours into a corridor around the river network that
   * tapers into the branched fingertips; the tide front (flood distance) and
   * the fading reveal the matter over time, and carving progressively opens
   * lighter beds in the delta.
   */
  private inkAt(i: number, front: number, reveal: number, ramIn: number, fade: number): number {
    const river = this.river;
    const flood = this.flood;
    const ram = this.ram;
    const noise = this.noise;
    if (!river || !flood || !ram || !noise) return 0;
    const gw = this.gw;
    const gh = this.gh;
    const maxF = this.maxFlood;
    const cx = i % gw;
    const cy = (i / gw) | 0;
    const nx = (cx + 0.5) / gw;
    const ny = (cy + 0.5) / gh;

    const d = river[i];
    const f = flood[i];
    const prog = maxF > 0 ? sat(f / maxF) : 1;
    const tper = smooth(0.06, 0.85, prog);
    const sigma = 2.5 * (1.15 - 0.6 * tper);
    const tube = Math.exp(-(d * d) / (2 * sigma * sigma));
    const halo = Math.exp(-(d * d) / (2 * sigma * sigma * 9));
    const dx = nx - 0.5;
    const dy = ny - 0.03;
    const pool = Math.exp(-(dx * dx) / 0.04 - (dy * dy) / 0.0256);

    const noiseBase = 0.4 + 0.35 * noise[i];
    const carveSigma = 1.45 * (1 + 0.8 * prog);
    const carve = reveal * Math.exp(-(d * d) / (2 * carveSigma * carveSigma));

    const fw = maxF > 0 ? sat(1 - (f - front * maxF) / SOFT_CELLS) : 1;
    const wet = fw * fw * (3 - 2 * fw);

    const thinned = 0.95 - 0.35 * tper;
    const shape = tube + pool + ram[i] * ramIn;
    const gate = sat(shape * 2.6);

    let t = gate * noiseBase * (0.95 * tube * thinned + 0.62 * pool + 0.4 * ram[i] * ramIn + 0.05 * halo);
    t *= wet * fade;
    t *= 1 - 0.6 * carve;
    return t < 0 ? 0 : t > 1 ? 1 : t;
  }

  // ---- rendering --------------------------------------------------------------

  private bakeRaster(): void {
    const ink = this.ink;
    const img = this.image;
    if (!ink || !img) return;
    const data = img.data;
    const noise = this.noise;
    for (let i = 0; i < ink.length; i++) {
      let k = ink[i];
      k = k < 0 ? 0 : k > 1 ? 1 : k;
      const j = i * 4;
      const grain = noise ? (noise[i] - 0.5) * 8 : 0;
      data[j] = INK_R + grain;
      data[j + 1] = INK_G + grain;
      data[j + 2] = INK_B + grain;
      data[j + 3] = (k * 255) | 0;
    }
  }

  private renderFrame(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    const pw = this.pw;
    const ph = this.ph;

    ctx.fillStyle = this.paperGrad ?? PAPER_TOP;
    ctx.fillRect(0, 0, pw, ph);
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, pw, ph);

    const sim = this.sim;
    const image = this.image;
    if (sim && image) {
      const simCtx = sim.getContext("2d");
      if (simCtx) {
        simCtx.putImageData(image, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(sim, 0, 0, this.gw, this.gh, 0, 0, pw, ph);
      }
    }

    this.drawGold();
    this.drawFlecks();
    this.drawCurrent();
  }

  /** When paused and unreduced: paper backdrop so the back never reads empty. */
  private renderPaperOnly(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    ctx.fillStyle = this.paperGrad ?? PAPER_TOP;
    ctx.fillRect(0, 0, this.pw, this.ph);
    ctx.fillStyle = this.vigGrad ?? "transparent";
    ctx.fillRect(0, 0, this.pw, this.ph);
  }

  /** Reduced-motion: the fully revealed delta, drawn once, no loop. */
  private renderFinal(): void {
    this.revealVis = 1;
    const ink = this.ink;
    if (!ink) return;
    for (let i = 0; i < ink.length; i++) {
      ink[i] = this.inkAt(i, 1, 1, 1, 1);
    }
    this.bakeRaster();
    this.renderFrame();
  }

  private drawGold(): void {
    const ctx = this.ctx;
    const reveal = this.revealVis;
    if (!ctx || reveal < 0.03 || this.pw === 0) return;
    const mx = this.mouth.x * this.pw;
    const my = this.mouth.y * this.ph;
    const r = Math.min(this.pw, this.ph) * 0.22;
    const glow = ctx.createRadialGradient(mx, my, 0, mx, my, r);
    glow.addColorStop(0, GOLD_CORE);
    glow.addColorStop(0.55, GOLD_MID);
    glow.addColorStop(1, GOLD_RIM);
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, reveal * 0.85));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawFlecks(): void {
    const ctx = this.ctx;
    if (!ctx || this.pw === 0) return;
    const reveal = this.revealVis;
    if (reveal < 0.03) return;
    const drift = this.reduced ? 0 : this.t;
    const mx = this.mouth.x * this.pw;
    const my = this.mouth.y * this.ph;
    const baseR = Math.min(this.pw, this.ph) * 0.06;
    for (const fleck of this.flecks) {
      const ang = fleck.a + drift * fleck.w;
      const wob = 0.5 + 0.5 * Math.sin(drift * fleck.phase + ang * 2);
      const rx = (0.25 + 0.75 * wob) * baseR;
      const ry = rx * 0.55;
      const px = mx + Math.cos(ang) * rx;
      const py = my + Math.sin(ang) * ry;
      const shimmer = this.reduced ? 0.1 : 0.08 + 0.12 * (0.5 + 0.5 * Math.sin(drift * fleck.pulse + fleck.phase));
      ctx.save();
      ctx.globalAlpha = clamp01(shimmer * reveal);
      ctx.fillStyle = `rgba(${FLECK}, 1)`;
      ctx.beginPath();
      ctx.arc(px, py, fleck.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCurrent(): void {
    const ctx = this.ctx;
    if (!ctx || this.reduced || this.ink === null) return;
    const speed = Math.hypot(this.pointer.vx, this.pointer.vy);
    if (speed < 0.015) return;
    const px = this.pointer.x * this.pw;
    const py = this.pointer.y * this.ph;
    const pull = Math.min(1, speed * 5);
    const nx = this.pointer.vx / speed;
    const ny = this.pointer.vy / speed;
    const len = Math.min(this.pw, this.ph) * 0.06;
    ctx.save();
    ctx.globalAlpha = 0.2 * pull;
    ctx.strokeStyle = "rgba(24, 30, 38, 1)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(px - nx * len * 0.5, py - ny * len * 0.5);
    ctx.lineTo(px + nx * len * 0.5, py + ny * len * 0.5);
    ctx.stroke();
    ctx.restore();
  }
}

export const inkTideAnimation: VersoAnimationDefinition = {
  id: "ink_tide",
  create: () => new InkTideScene(),
};