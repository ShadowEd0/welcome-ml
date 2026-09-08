/**
 * "celestial_orbits" — nested planetary orbits, orbital family.
 *
 * A wave-orbit (swaying ring) surrounded by a calm guiding circle and a
 * smaller inner circle, on the midnight-observatory sky. Cool blue light,
 * a moon-pearl tracer and a light-echo trail evoke distant worlds.
 */

import type { MathVersoEntry } from "../../catalog";
import { waveOrbit, circle } from "../../functions";
import { MathScene } from "../../scene";
import { createMidnightObservatory } from "../../universes";
import { createMoonPearl } from "../../tracers/moonPearl";
import { createOrbitingMote } from "../../tracers/orbitingMote";
import { createLightEcho } from "../../trails/lightEcho";
import { createOrbitTrace } from "../../trails/orbitTrace";
import { makeLayer, compose } from "./helpers";

const BLUE = "#8fb8ff";
const SOFT = "#6f92d0";

export function createCelestialOrbits(): MathScene {
  return new MathScene({
    id: "celestial_orbits",
    composition: compose([
      makeLayer(waveOrbit(1.1, 0.22, 5), BLUE, {
        lineWidth: 1.5,
        glow: 1.4,
        tracer: createMoonPearl(0, { x: 0, y: 0 }, { size: 0.05 }),
        trail: createLightEcho(BLUE, { capacity: 30, baseOpacity: 0.45 }),
      }),
      makeLayer(circle(1.42), SOFT, {
        lineWidth: 1.1,
        glow: 0.8,
      }),
      makeLayer(circle(0.6), "#cfe0ff", {
        transform: { rotation: Math.PI / 4 },
        lineWidth: 1.2,
        glow: 0.9,
        tracer: createOrbitingMote(0, { x: 0, y: 0 }, { size: 0.05 }),
        trail: createOrbitTrace("#cfe0ff", { capacity: 40, baseOpacity: 0.4 }),
      }),
    ]),
    universe: createMidnightObservatory(),
    tracerSpeed: 0.35,
    tracerLoops: true,
  });
}

export const celestialOrbits: MathVersoEntry = {
  id: "celestial_orbits",
  name: "Orbites célestes",
  family: "orbital",
  description: "Cercles et orbites ondulantes imbriqués sur midnight_observatory.",
  create: createCelestialOrbits,
};
