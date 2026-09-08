/**
 * "rose_galaxy" — a dense, spectacular field of roses, spectacular family.
 *
 * Three rose layers (k=5, k=7, k=3) of different scale and rotation overlap
 * into a rich, kaleidoscopic bloom on the midnight sky. Intense, controlled
 * colour; only the dominant rose carries a tracer so it never feels noisy.
 */

import type { MathVersoEntry } from "../../catalog";
import { rose, circle } from "../../functions";
import { MathScene } from "../../scene";
import { createMidnightObservatory } from "../../universes";
import { createRoseSpark } from "../../tracers/roseSpark";
import { createFadingLine } from "../../trails/fadingLine";
import { createSilkRibbon } from "../../trails/silkRibbon";
import { createInkTrace } from "../../trails/inkTrace";
import { makeLayer, compose } from "./helpers";

const GOLD = "#ffd27a";
const CORAL = "#ff8f8f";
const SKY = "#7fb8ff";
const RING = "#efe6ff";

export function createRoseGalaxy(): MathScene {
  return new MathScene({
    id: "rose_galaxy",
    composition: compose([
      makeLayer(rose(5), GOLD, {
        lineWidth: 1.6,
        glow: 1.6,
        tracer: createRoseSpark(0, { x: 0, y: 0 }, { size: 0.055 }),
        trail: createFadingLine(GOLD, { capacity: 70, baseOpacity: 0.5, width: 1.3 }),
      }),
      makeLayer(rose(7), CORAL, {
        transform: { rotation: Math.PI / 6, scale: 0.8 },
        lineWidth: 1.2,
        glow: 1.1,
        trail: createSilkRibbon(CORAL, { capacity: 55, baseOpacity: 0.42 }),
      }),
      makeLayer(rose(3), SKY, {
        transform: { scale: 0.55 },
        lineWidth: 1.1,
        glow: 0.9,
        trail: createInkTrace(SKY, { capacity: 45, baseOpacity: 0.4 }),
      }),
      makeLayer(circle(1.05), RING, {
        lineWidth: 1.0,
        glow: 0.5,
      }),
    ]),
    universe: createMidnightObservatory(),
    tracerSpeed: 0.3,
    tracerLoops: true,
  });
}

export const roseGalaxy: MathVersoEntry = {
  id: "rose_galaxy",
  name: "Galaxie de roses",
  family: "spectacular",
  description: "Trois roses superposées et un anneau, somptueux sur midnight.",
  create: createRoseGalaxy,
};
