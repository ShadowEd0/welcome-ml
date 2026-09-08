/**
 * "golden_spiral" — a single luminous Archimedean spiral, orbital family.
 *
 * A warm golden spiral expanding from the centre on the golden-hour sky.
 * One comet tracer leaves a faint spark trail, drawing a calm, endless
 * orbit. Minimal and luminous.
 */

import type { MathVersoEntry } from "../../catalog";
import { spiral } from "../../functions";
import { MathScene } from "../../scene";
import { createGoldenHour } from "../../universes";
import { createCometSpark } from "../../tracers/cometSpark";
import { createGoldenDust } from "../../trails/goldenDust";
import { makeLayer, compose } from "./helpers";

export function createGoldenSpiral(): MathScene {
  return new MathScene({
    id: "golden_spiral",
    composition: compose([
      makeLayer(spiral(0.04, 0.22, 3.5), "#ffd9a0", {
        lineWidth: 1.7,
        glow: 1.6,
        count: 700,
        tracer: createCometSpark(0, { x: 0, y: 0 }, { size: 0.06 }),
        trail: createGoldenDust("#ffd9a0", { capacity: 70, baseOpacity: 0.55 }),
      }),
    ]),
    universe: createGoldenHour(),
    tracerSpeed: 0.5,
    tracerLoops: false,
  });
}

export const goldenSpiral: MathVersoEntry = {
  id: "golden_spiral",
  name: "Spirale dorée",
  family: "orbital",
  description: "Spirale d'Archimède lumineuse sur golden_hour.",
  create: createGoldenSpiral,
};
