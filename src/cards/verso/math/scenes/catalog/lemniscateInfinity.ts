/**
 * "lemniscate_infinity" — crossed lemniscates, geometric family.
 *
 * Two lemniscates in perpendicular directions form an elegant infinity
 * figure on the violet-dream sky. A calm violet/azure palette with a
 * luminous tracer and a light-echo trail.
 */

import type { MathVersoEntry } from "../../catalog";
import { lemniscate } from "../../functions";
import { MathScene } from "../../scene";
import { createVioletDream } from "../../universes";
import { createLuminousPointTracer } from "../../tracers/luminousPoint";
import { createLightEcho } from "../../trails/lightEcho";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";

const VIOLET = "#d4a6ff";
const AZURE = "#a6c8ff";

export function createLemniscateInfinity(): MathScene {
  return new MathScene({
    id: "lemniscate_infinity",
    composition: compose([
      makeLayer(lemniscate(1.1), VIOLET, {
        lineWidth: 1.6,
        glow: 1.4,
        tracer: createLuminousPointTracer(0, { x: 0, y: 0 }, { size: 0.05, color: VIOLET }),
        trail: createLightEcho(VIOLET, { capacity: 32, baseOpacity: 0.45 }),
      }),
      makeLayer(lemniscate(1.1), AZURE, {
        transform: { rotation: Math.PI / 2 },
        lineWidth: 1.2,
        glow: 0.9,
        trail: createFadingLine(AZURE, { capacity: 45, baseOpacity: 0.35, width: 1 }),
      }),
    ]),
    universe: createVioletDream(),
    tracerSpeed: 0.3,
    tracerLoops: true,
  });
}

export const lemniscateInfinity: MathVersoEntry = {
  id: "lemniscate_infinity",
  name: "Infini croisé",
  family: "geometric",
  description: "Deux lemniscates perpendiculaires en figure d'infini.",
  create: createLemniscateInfinity,
};
