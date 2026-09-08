/**
 * "aizawa_vortex" — Aizawa attractor vortex, spectacular family.
 *
 * The Aizawa double-scroll: dx=(z−b)x−d·y, dy=d·x+(z−b)y,
 * dz=c+a·z−z³/3−(x²+y²)(1+e·z)+f·z·x³ with a=0.95, b=0.7, c=0.6, d=3.5,
 * e=0.25, f=0.1. Integrated with RK2 (dt=0.012), tilted-camera projected
 * and normalized. A supercritical funnel of pale ice and violet.
 */

import type { MathVersoEntry } from "../../catalog";
import { MathScene } from "../../scene";
import { createVoidIce } from "../../universes";
import { createLuminousPointTracer } from "../../tracers/luminousPoint";
import { createSilkRibbon } from "../../trails/silkRibbon";
import { createOrbitTrace } from "../../trails/orbitTrace";
import { orbit3D, pointLayer } from "./numerics";
import { compose } from "./helpers";

const ICE = "#bfe6ff";
const VIOLET = "#cb93ff";
const CORE = "#eafaff";

const A = 0.95;
const B = 0.7;
const C = 0.6;
const D = 3.5;
const E = 0.25;
const F = 0.1;

function aizawa(): { x: number; y: number }[] {
  return orbit3D(
    (p) => {
      const [x, y, z] = p;
      return [
        (z - B) * x - D * y,
        D * x + (z - B) * y,
        C + A * z - (z * z * z) / 3 - (x * x + y * y) * (1 + E * z) + F * z * x * x * x,
      ];
    },
    1500,
    { dt: 0.012, warmup: 2500, start: [0.1, 0, 0.1], theta: 0.6, phi: 0.3 }
  );
}

export function createAizawaVortex(): MathScene {
  const points = aizawa();
  const echo = points.filter((_, i) => i % 2 === 0);
  return new MathScene({
    id: "aizawa_vortex",
    composition: compose([
      pointLayer(points, ICE, {
        lineWidth: 1.2,
        glow: 1.1,
        tracer: createLuminousPointTracer(0, { x: 0, y: 0 }, { size: 0.045, color: CORE }),
        trail: createSilkRibbon(ICE, { capacity: 160, baseOpacity: 0.42 }),
        reveal: { duration: 4.6 },
      }),
      pointLayer(echo, VIOLET, {
        transform: { rotation: Math.PI, scale: 0.96 },
        lineWidth: 0.9,
        glow: 0.7,
        trail: createOrbitTrace(VIOLET, { capacity: 80, baseOpacity: 0.3 }),
      }),
    ]),
    universe: createVoidIce(),
    tracerSpeed: 0.6,
    tracerLoops: true,
  });
}

export const aizawaVortex: MathVersoEntry = {
  id: "aizawa_vortex",
  name: "Vortex d'Aizawa",
  family: "spectacular",
  description: "Attracteur d'Aizawa en vortex sur void_ice.",
  create: createAizawaVortex,
};