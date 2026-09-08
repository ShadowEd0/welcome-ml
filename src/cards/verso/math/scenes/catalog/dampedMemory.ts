/**
 * "damped_memory" — layered damped waves, poetic family.
 *
 * Two damped oscillations of different frequency overlap into a soft,
 * melancholic line — a quiet, abstract trace over a moonlit-paper backdrop.
 * Ink-like colours, an ink tracer and an ink trace keep it understated.
 */

import type { MathVersoEntry } from "../../catalog";
import { dampedWave } from "../../functions";
import { MathScene } from "../../scene";
import { createMoonlitPaper } from "../../universes";
import { createLuminousPointTracer } from "../../tracers/luminousPoint";
import { createInkTrace } from "../../trails/inkTrace";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";

export function createDampedMemory(): MathScene {
  return new MathScene({
    id: "damped_memory",
    composition: compose([
      makeLayer(dampedWave(0.7, 2, 0.5), "#8a6fbd", {
        lineWidth: 1.6,
        glow: 1.0,
        count: 500,
        tracer: createLuminousPointTracer(0, { x: 0, y: 0 }, { size: 0.05, color: "#8a6fbd" }),
        trail: createInkTrace("#8a6fbd", { capacity: 60, baseOpacity: 0.5 }),
      }),
      makeLayer(dampedWave(0.6, 3, 0.7), "#b095d8", {
        transform: { translation: { x: 0, y: 0.25 } },
        lineWidth: 1.1,
        glow: 0.6,
        count: 500,
        trail: createFadingLine("#b095d8", { capacity: 50, baseOpacity: 0.35, width: 1 }),
      }),
    ]),
    universe: createMoonlitPaper(),
    tracerSpeed: 0.4,
    tracerLoops: false,
  });
}

export const dampedMemory: MathVersoEntry = {
  id: "damped_memory",
  name: "Mémoire amortie",
  family: "poetic",
  description: "Ondes amorties superposées, discrètes, sur moonlit_paper.",
  create: createDampedMemory,
};
