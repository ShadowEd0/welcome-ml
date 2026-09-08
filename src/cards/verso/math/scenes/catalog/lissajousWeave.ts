/**
 * "lissajous_weave" — interlaced Lissajous curves, parametric family.
 *
 * A dense Lissajous figure (a=4, b=3) is mirrored vertically and rotated
 * slightly to weave a rich, symmetric pattern on the cosmic-plum sky.
 * A prism-shard tracer and a spark-fragment trail add crystalline light.
 */

import type { MathVersoEntry } from "../../catalog";
import { lissajous } from "../../functions";
import { MathScene } from "../../scene";
import { createCosmicPlum } from "../../universes";
import { createPrismShard } from "../../tracers/prismShard";
import { createCrystalTrace } from "../../trails/crystalTrace";
import { createSparkFragment } from "../../trails/sparkFragment";
import { makeLayer, compose } from "./helpers";

const PLUM = "#e0b8ff";
const LILAC = "#b88adf";

export function createLissajousWeave(): MathScene {
  return new MathScene({
    id: "lissajous_weave",
    composition: compose([
      makeLayer(lissajous(4, 3), PLUM, {
        lineWidth: 1.4,
        glow: 1.2,
        tracer: createPrismShard(0, { x: 0, y: 0 }, { size: 0.05 }),
        trail: createCrystalTrace(PLUM, { capacity: 50, baseOpacity: 0.45 }),
      }),
      makeLayer(lissajous(4, 3), LILAC, {
        transform: { mirrorY: true, rotation: Math.PI / 4 },
        lineWidth: 1.0,
        glow: 0.8,
        trail: createSparkFragment(LILAC, { capacity: 40, baseOpacity: 0.35 }),
      }),
    ]),
    universe: createCosmicPlum(),
    tracerSpeed: 0.4,
    tracerLoops: true,
  });
}

export const lissajousWeave: MathVersoEntry = {
  id: "lissajous_weave",
  name: "Tissage de Lissajous",
  family: "parametric",
  description: "Figures de Lissajous croisées et symétriques sur cosmic_plum.",
  create: createLissajousWeave,
};
