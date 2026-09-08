/**
 * Math Verso Engine — scene simulation helpers.
 *
 * Small, engine-agnostic tools for scenes whose geometry comes from
 * repeated iteration (diffeomorphic maps, ODE attractors) or numerical
 * integration (Euler/Fresnel spiral) rather than a single closed formula.
 *
 * Everything here is precomputed ONCE at scene build time and exposed as
 * a pure `MathFunction` over t in [0,1] → array index, so it plugs into
 * the existing sampling + tracer pipeline with zero engine change.
 */

import type { CurveLayer, MathFunction, SampledCurve, RevealLayerSpec, Tracer, Trail, Transform2D, WorldPoint } from "../../types";

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** A point array indexed by round(t * (n-1)): pure, 1:1 with the polyline. */
export function arrayFunction(points: readonly WorldPoint[]): MathFunction {
  const n = points.length - 1;
  return (t) => {
    const i = Math.max(0, Math.min(n, Math.round(t * n) | 0));
    return points[i];
  };
}

/**
 * Center a point cloud on its centroid and uniformly scale it so the peak
 * radius equals `target`. Non-finite samples are ignored by the geometry
 * so a few bad orbits cannot drag the whole composition off-canvas.
 */
export function normalize(points: Vec2[], target = 1): Vec2[] {
  let cx = 0;
  let cy = 0;
  let n = 0;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    cx += p.x;
    cy += p.y;
    n++;
  }
  if (n === 0) return points.map(() => ({ x: 0, y: 0 }));
  cx /= n;
  cy /= n;

  let peak = 1e-9;
  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    if (d > peak) peak = d;
  }
  const s = target / peak;
  return points.map((p) => ({ x: (p.x - cx) * s, y: (p.y - cy) * s }));
}

/** Build a SampledCurve directly from precomputed world points (no re-sample). */
export function sampledFromPoints(points: readonly WorldPoint[]): SampledCurve {
  return {
    fn: arrayFunction(points),
    spec: { domain: { min: 0, max: 1 }, count: points.length - 1 },
    points,
    closed: false,
  };
}

/** Build a CurveLayer over a precomputed point cloud. */
export function pointLayer(
  points: readonly WorldPoint[],
  color: string,
  opts: {
    transform?: Transform2D;
    lineWidth?: number;
    glow?: number;
    tracer?: Tracer;
    trail?: Trail;
    reveal?: RevealLayerSpec;
  } = {}
): CurveLayer {
  return {
    id: "orbit",
    curve: sampledFromPoints(points),
    color,
    lineWidth: opts.lineWidth ?? 1.3,
    glow: opts.glow ?? 1,
    transform: opts.transform,
    tracer: opts.tracer,
    trail: opts.trail,
    reveal: opts.reveal,
  };
}

/** Iterate a discrete 2D recurrence, optionally warming up first. */
export function orbit2D(
  step: (p: Vec2) => Vec2,
  count: number,
  warmup = 0,
  start: Vec2 = { x: 0.1, y: 0 }
): Vec2[] {
  let p = start;
  for (let i = 0; i < warmup; i++) p = step(p);
  const out: Vec2[] = new Array(count);
  for (let i = 0; i < count; i++) {
    p = step(p);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) p = start;
    out[i] = { x: p.x, y: p.y };
  }
  return out;
}

/** Midpoint (RK2) step of an ODE — accurate enough for visual attractors. */
export function rk2Step(
  deriv: (p: [number, number, number]) => [number, number, number],
  p: [number, number, number],
  dt: number
): [number, number, number] {
  const k1 = deriv(p);
  const mid: [number, number, number] = [
    p[0] + k1[0] * (dt / 2),
    p[1] + k1[1] * (dt / 2),
    p[2] + k1[2] * (dt / 2),
  ];
  const k2 = deriv(mid);
  return [
    p[0] + k2[0] * dt,
    p[1] + k2[1] * dt,
    p[2] + k2[2] * dt,
  ];
}

/** Integrate a 3D ODE, project to 2D with a tilted camera, then normalize. */
export function orbit3D(
  deriv: (p: [number, number, number]) => [number, number, number],
  count: number,
  opts: {
    dt?: number;
    warmup?: number;
    start?: [number, number, number];
    theta?: number;
    phi?: number;
    target?: number;
  } = {}
): Vec2[] {
  const dt = opts.dt ?? 0.02;
  const warmup = opts.warmup ?? 1000;
  const start: [number, number, number] = opts.start ?? [0.1, 0, 0];
  const theta = opts.theta ?? 0.5;
  const phi = opts.phi ?? 0.3;
  const target = opts.target ?? 1;

  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const cp = Math.cos(phi);
  const sp = Math.sin(phi);

  let p: [number, number, number] = start;
  for (let i = 0; i < warmup; i++) p = rk2Step(deriv, p, dt);

  const out: Vec2[] = new Array(count);
  for (let i = 0; i < count; i++) {
    p = rk2Step(deriv, p, dt);
    // Rotate around Y, then around X, then project orthographically.
    const x1 = p[0] * ct + p[2] * st;
    const z1 = -p[0] * st + p[2] * ct;
    const y1 = p[1] * cp - z1 * sp;
    out[i] = { x: x1, y: y1 };
  }
  return normalize(out, target);
}

/**
 * Euler (Cornu/Fresnel) spiral, C(u)=∫cos(πu²/2), S(u)=∫sin(πu²/2).
 * Integrated with the midpoint rule at a fine fixed step (no Taylor
 * approximation that would diverge), both arms (−range..+range), re-sampled
 * to `count` evenly spaced points.
 */
export function eulerSpiral(count: number, range: number): Vec2[] {
  const h = 1 / 900;
  const n = Math.ceil(range / h);
  let c = 0;
  let s = 0;
  // Positive arm: points at u = h, 2h, …, n·h.
  const pos: Vec2[] = new Array(n);
  for (let i = 1; i <= n; i++) {
    const tm = (i - 0.5) * h;
    c += Math.cos((Math.PI / 2) * tm * tm) * h;
    s += Math.sin((Math.PI / 2) * tm * tm) * h;
    pos[i - 1] = { x: c, y: s };
  }
  // Negative arm mirrored through the origin.
  const neg: Vec2[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const q = pos[n - 1 - i];
    neg[i] = { x: -q.x, y: -q.y };
  }
  const all = [...neg, ...pos];
  const out: Vec2[] = new Array(count);
  const m = all.length - 1;
  for (let i = 0; i < count; i++) {
    const f = (i / (count - 1)) * m;
    const lo = Math.floor(f);
    const hi = Math.min(m, lo + 1);
    const a = f - lo;
    const p0 = all[lo];
    const p1 = all[hi];
    out[i] = { x: p0.x + (p1.x - p0.x) * a, y: p0.y + (p1.y - p0.y) * a };
  }
  return normalize(out);
}