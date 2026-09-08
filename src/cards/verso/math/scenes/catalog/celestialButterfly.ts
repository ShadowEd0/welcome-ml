/**
 * "celestial_butterfly" — a radiant butterfly, poetic family.
 *
 * A single butterfly curve in warm rose-gold on the rose-cosmos sky, with a
 * thicker companion silhouette rotated slightly. A rose-spark tracer and a
 * vanishing-glow trail give it a soft, dreamlike flight.
 */

import type { MathVersoEntry } from "../../catalog";
import { butterfly } from "../../functions";
import { MathScene } from "../../scene";
import { createRoseCosmos } from "../../universes";
import { createRoseSpark } from "../../tracers/roseSpark";
import { createVanishingGlow } from "../../trails/vanishingGlow";
import { createGoldenDust } from "../../trails/goldenDust";
import { makeLayer, compose } from "./helpers";

const GOLD = "#ffd9a0";
const PINK = "#ffa8c8";

export function createCelestialButterfly(): MathScene {
  return new MathScene({
    id: "celestial_butterfly",
    composition: compose([
      makeLayer(butterfly(0.75), GOLD, {
        lineWidth: 1.8,
        glow: 1.7,
        count: 500,
        tracer: createRoseSpark(0, { x: 0, y: 0 }, { size: 0.06 }),
        trail: createGoldenDust(GOLD, { capacity: 70, baseOpacity: 0.5 }),
      }),
      makeLayer(butterfly(0.5), PINK, {
        transform: { rotation: Math.PI / 6 },
        lineWidth: 1.1,
        glow: 0.8,
        count: 500,
        trail: createVanishingGlow(PINK, { capacity: 40, baseOpacity: 0.4 }),
      }),
    ]),
    universe: createRoseCosmos(),
    tracerSpeed: 0.28,
    tracerLoops: true,
  });
}

export const celestialButterfly: MathVersoEntry = {
  id: "celestial_butterfly",
  name: "Papillon céleste",
  family: "poetic",
  description: "Papillon doré et silhouette rose sur rose_cosmos.",
  create: createCelestialButterfly,
};
