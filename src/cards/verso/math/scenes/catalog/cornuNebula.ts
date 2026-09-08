/**
 * "cornu_nebula" — Euler/fresnel spiral nebula, spectacular family.
 *
 * The Cornu spiral C(u)=∫cos(πu²/2), S(u)=∫sin(πu²/2) integrated robustly
 * with the midpoint rule (no divergent Taylor term), then drawn as two
 * mirrored arms that curl into a soft cosmic bloom — a planetary nebula in
 * the plum cosmos.
 */

import type { MathVersoEntry } from "../../catalog";
import { MathScene } from "../../scene";
import { createCosmicPlum } from "../../universes";
import { createPrismShard } from "../../tracers/prismShard";
import { createMistTrail } from "../../trails/mistTrail";
import { eulerSpiral, pointLayer } from "./numerics";
import { compose } from "./helpers";

const VIOLET = "#caa6ff";
const ROSE = "#ff9bd0";
const LILAC = "#a78bff";

export function createCornuNebula(): MathScene {
  const spiral = eulerSpiral(1300, 2.0);
  return new MathScene({
    id: "cornu_nebula",
    composition: compose([
      // Animated main arm (pen + mist).
      pointLayer(spiral, VIOLET, {
        transform: { rotation: 1.32 },
        lineWidth: 1.8,
        glow: 2,
        tracer: createPrismShard(0, { x: 0, y: 0 }, { size: 0.08 }),
        trail: createMistTrail(VIOLET, { capacity: 140, baseOpacity: 0.6 }),
        reveal: { duration: 4.2 },
      }),
      // Persistent bright skeleton: the spiral stays readable in full even
      // when the mist has faded — the structure, not only the moving glow.
      pointLayer(spiral, LILAC, {
        transform: { rotation: 1.32 },
        lineWidth: 2.2,
        glow: 2.4,
      }),
      // Soft mirrored bloom (persistent).
      pointLayer(spiral, ROSE, {
        transform: { rotation: Math.PI, scale: 0.84 },
        lineWidth: 1.2,
        glow: 1.2,
        reveal: { delay: 0.3, duration: 3 },
      }),
      // Inner counter-tilted curl (persistent).
      pointLayer(spiral, VIOLET, {
        transform: { rotation: -1.05, scale: 0.5 },
        lineWidth: 1,
        glow: 0.9,
        reveal: { delay: 0.5, duration: 2.6 },
      }),
    ]),
    universe: createCosmicPlum(),
    tracerSpeed: 0.34,
    tracerLoops: true,
  });
}

export const cornuNebula: MathVersoEntry = {
  id: "cornu_nebula",
  name: "Nébuleuse de Cornu",
  family: "spectacular",
  description: "Spirale de Cornu en nébuleuse sur cosmic_plum.",
  create: createCornuNebula,
};