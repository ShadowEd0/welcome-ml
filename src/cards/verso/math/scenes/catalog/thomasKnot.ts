/**
 * "thomas_knot" — Thomas attractor, spectacular family.
 *
 * A classic chaotic attractor: ẋ=sin y − b·x, ẏ=sin z − b·y, ż=sin x − b·z
 * with b≈0.2081 (dt=0.02). Integrated with RK2, precomputed once,
 * projected from 3D with a tilted "camera" and normalized. The resulting
 * knot dances like tangled silk on emerald-garden glows.
 */

import type { MathVersoEntry } from "../../catalog";
import { MathScene } from "../../scene";
import { createEmeraldGarden } from "../../universes";
import { createLuminousPointTracer } from "../../tracers/luminousPoint";
import { createSilkRibbon } from "../../trails/silkRibbon";
import { orbit3D, pointLayer } from "./numerics";
import { makeLayer, compose } from "./helpers";
import { circle } from "../../functions";

const AQUA = "#a8e7d0";
const MINT = "#6bc7aa";
const FOREST = "#3a8f7a";

function thomas(): { x: number; y: number }[] {
  const b = 0.2081;
  return orbit3D(
    (p) => [
      Math.sin(p[1]) - b * p[0],
      Math.sin(p[2]) - b * p[1],
      Math.sin(p[0]) - b * p[2],
    ],
    2600,
    { dt: 0.02, warmup: 2500, start: [0.1, 0, 0], theta: 0.5, phi: 0.35 }
  );
}

export function createThomasKnot(): MathScene {
  const points = thomas();
  // A lighter echo layer: every second point, half the rendering cost.
  const echo = points.filter((_, i) => i % 2 === 0);
  return new MathScene({
    id: "thomas_knot",
    composition: compose([
      pointLayer(points, AQUA, {
        lineWidth: 1.3,
        glow: 1.5,
        tracer: createLuminousPointTracer(0, { x: 0, y: 0 }, { size: 0.06, color: "#d3ffe9" }),
        trail: createSilkRibbon(AQUA, { capacity: 260, baseOpacity: 0.85 }),
        reveal: { duration: 4.4 },
      }),
      pointLayer(echo, FOREST, {
        transform: { rotation: 0.9, scale: 0.98 },
        lineWidth: 0.8,
        glow: 0.5,
      }),
      makeLayer(circle(0.14), MINT, { lineWidth: 1, glow: 0.8 }),
    ]),
    universe: createEmeraldGarden(),
    tracerSpeed: 0.6,
    tracerLoops: true,
  });
}

export const thomasKnot: MathVersoEntry = {
  id: "thomas_knot",
  name: "Nœud de Thomas",
  family: "spectacular",
  description: "Attracteur de Thomas noué sur emerald_garden.",
  create: createThomasKnot,
};