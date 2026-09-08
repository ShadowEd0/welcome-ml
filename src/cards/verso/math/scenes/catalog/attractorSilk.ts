/**
 * "attractor_silk" — Clifford attractor woven in silk, spectacular family.
 *
 * x' = sin(a·y) + c·cos(a·x), y' = sin(b·x) + d·cos(b·y) with a=-1.4,
 * b=1.6, c=1.0, d=0.7 — the classic Clifford "bow-tie" chaos. Precomputed
 * once as a point cloud (no per-frame iteration), normalized to the unit
 * circle, and traced in soft rose silks over a smoky backdrop.
 */

import type { MathVersoEntry } from "../../catalog";
import { MathScene } from "../../scene";
import { createSilkSmoke } from "../../universes";
import { createLuminousPointTracer } from "../../tracers/luminousPoint";
import { createSilkRibbon } from "../../trails/silkRibbon";
import { orbit2D, pointLayer, normalize, type Vec2 } from "./numerics";
import { compose } from "./helpers";

const SILK = "#f4c6b8";
const DEEP = "#e08d9a";
const CORE = "#ffe3d4";

const A = -1.4;
const B = 1.6;
const C = 1.0;
const D = 0.7;

function clifford(): Vec2[] {
  // Normalized to the unit disc and centered on the cloud's centroid so the
  // butterfly keeps both wings on-canvas after the coordinate-system auto-fit.
  return normalize(
    orbit2D(
      (p) => ({
        x: Math.sin(A * p.y) + C * Math.cos(A * p.x),
        y: Math.sin(B * p.x) + D * Math.cos(B * p.y),
      }),
      2600,
      250,
      { x: 0.1, y: 0 }
    )
  );
}

export function createAttractorSilk(): MathScene {
  const points = clifford();
  return new MathScene({
    id: "attractor_silk",
    composition: compose([
      pointLayer(points, SILK, {
        lineWidth: 1.1,
        glow: 1.2,
        tracer: createLuminousPointTracer(0, { x: 0, y: 0 }, { size: 0.055, color: CORE }),
        trail: createSilkRibbon(SILK, { capacity: 260, baseOpacity: 0.55 }),
        reveal: { duration: 4.4 },
      }),
      pointLayer(points, DEEP, {
        transform: { rotation: Math.PI / 5, scale: 0.94 },
        lineWidth: 0.7,
        glow: 0.6,
        trail: createSilkRibbon(DEEP, { capacity: 90, baseOpacity: 0.22 }),
      }),
    ]),
    universe: createSilkSmoke(),
    tracerSpeed: 0.55,
    tracerLoops: true,
  });
}

export const attractorSilk: MathVersoEntry = {
  id: "attractor_silk",
  name: "Soie d'attracteur",
  family: "spectacular",
  description: "Attracteur de Clifford tissé en soie sur silk_smoke.",
  create: createAttractorSilk,
};