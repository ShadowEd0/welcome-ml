/**
 * "clover_meadow" — layered clover blossoms, floral family.
 *
 * A four-leaf clover (k=4) drawn large, softened by a smaller echoed clover
 * and a thin guiding ring, on the emerald-garden backdrop. Green glow with
 * a firefly tracer and a mist trail for a dewy, organic feel.
 */

import type { MathVersoEntry } from "../../catalog";
import { clover, circle } from "../../functions";
import { MathScene } from "../../scene";
import { createEmeraldGarden } from "../../universes";
import { createFirefly } from "../../tracers/firefly";
import { createLuminousPointTracer } from "../../tracers/luminousPoint";
import { createMistTrail } from "../../trails/mistTrail";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";

const LEAF = "#7fddb0";
const LEAF_SOFT = "#5cb48a";
const RING = "#b5f0d0";

export function createCloverMeadow(): MathScene {
  return new MathScene({
    id: "clover_meadow",
    composition: compose([
      makeLayer(clover(4, 1), LEAF, {
        lineWidth: 1.6,
        glow: 1.2,
        tracer: createFirefly(0, { x: 0, y: 0 }, { size: 0.05 }),
        trail: createMistTrail(LEAF, { capacity: 50, baseOpacity: 0.4 }),
      }),
      makeLayer(clover(4, 0.62), LEAF_SOFT, {
        transform: { rotation: Math.PI / 4 },
        lineWidth: 1.2,
        glow: 0.8,
        tracer: createLuminousPointTracer(0, { x: 0, y: 0 }, { size: 0.04, color: LEAF_SOFT }),
        trail: createFadingLine(LEAF_SOFT, { capacity: 45, baseOpacity: 0.35, width: 1 }),
      }),
      makeLayer(circle(1.3), RING, {
        lineWidth: 1.1,
        glow: 0.6,
      }),
    ]),
    universe: createEmeraldGarden(),
    tracerSpeed: 0.28,
    tracerLoops: true,
  });
}

export const cloverMeadow: MathVersoEntry = {
  id: "clover_meadow",
  name: "Pré de trèfles",
  family: "floral",
  description: "Trèfles emboîtés et anneau sur emerald_garden, verts et vaporeux.",
  create: createCloverMeadow,
};
