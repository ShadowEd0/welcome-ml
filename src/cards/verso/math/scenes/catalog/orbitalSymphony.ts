/**
 * "orbital_symphony" — a layered orbital composition, spectacular family.
 *
 * A Lissajous figure weaves behind a pair of orbiting rings over the
 * deep-ocean sky. The three families (parametric + orbital) coexist in one
 * composed scene — a test of layered richness done elegantly.
 */

import type { MathVersoEntry } from "../../catalog";
import { lissajous, circle, waveOrbit } from "../../functions";
import { MathScene } from "../../scene";
import { createDeepOcean } from "../../universes";
import { createFirefly } from "../../tracers/firefly";
import { createOrbitingMote } from "../../tracers/orbitingMote";
import { createMistTrail } from "../../trails/mistTrail";
import { createLightEcho } from "../../trails/lightEcho";
import { createSilkRibbon } from "../../trails/silkRibbon";
import { makeLayer, compose } from "./helpers";

const TEAL = "#6fe0c8";
const AQUA = "#7fc8ff";
const FAINT = "#bfe8ff";

export function createOrbitalSymphony(): MathScene {
  return new MathScene({
    id: "orbital_symphony",
    composition: compose([
      makeLayer(lissajous(3, 2), FAINT, {
        lineWidth: 1.0,
        glow: 0.6,
        count: 500,
        trail: createSilkRibbon(FAINT, { capacity: 50, baseOpacity: 0.3 }),
      }),
      makeLayer(circle(1.25), TEAL, {
        lineWidth: 1.5,
        glow: 1.3,
        tracer: createFirefly(0, { x: 0, y: 0 }, { size: 0.05 }),
        trail: createMistTrail(TEAL, { capacity: 45, baseOpacity: 0.42 }),
      }),
      makeLayer(waveOrbit(1.25, 0.25, 4), AQUA, {
        transform: { rotation: Math.PI / 4 },
        lineWidth: 1.2,
        glow: 1.0,
        tracer: createOrbitingMote(0, { x: 0, y: 0 }, { size: 0.05 }),
        trail: createLightEcho(AQUA, { capacity: 28, baseOpacity: 0.4 }),
      }),
    ]),
    universe: createDeepOcean(),
    tracerSpeed: 0.3,
    tracerLoops: true,
  });
}

export const orbitalSymphony: MathVersoEntry = {
  id: "orbital_symphony",
  name: "Symphonie orbitale",
  family: "spectacular",
  description: "Lissajous, cercle et orbite ondulante en superposition océanique.",
  create: createOrbitalSymphony,
};
