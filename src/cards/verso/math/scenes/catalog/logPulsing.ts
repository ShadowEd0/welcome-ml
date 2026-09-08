/**
 * "log_pulsing" — logarithmically pulsing hypotrochoid, orbital family.
 *
 * A hypotrochoid whose radius breathes with S(t)=exp(sin(ω·t)·k): as the
 * trochoid is traced, the whole petal girdle swells and recedes, like the
 * slow heartbeat of a bioluminescent sea creature on the deep-ocean floor.
 * R/r = 4 keeps a clean four-lobe silhouette so the pulse stays readable.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createDeepOcean } from "../../universes";
import { createFirefly } from "../../tracers/firefly";
import { createVanishingGlow } from "../../trails/vanishingGlow";
import { createOrbitTrace } from "../../trails/orbitTrace";
import { makeLayer, compose } from "./helpers";

const LIME = "#b2fba5";
const TEAL = "#6fe0c0";

function pulsingHypotrochoid(R: number, r: number, k: number, omega: number): CurveSpec {
  return {
    id: "log_pulsing_hypotrochoid",
    fn: (t) => {
      const S = Math.exp(Math.sin(omega * t) * k) / Math.exp(k); // 0..1 breathing
      const scale = 0.9 + 0.5 * S;
      const x = (R - r) * Math.cos(t) + r * Math.cos((R / r) * t);
      const y = (R - r) * Math.sin(t) - r * Math.sin((R / r) * t);
      return { x: x * 0.45 * scale, y: y * 0.45 * scale };
    },
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Hypotrochoïde à respiration logarithmique.",
  };
}

export function createLogPulsing(): MathScene {
  return new MathScene({
    id: "log_pulsing",
    composition: compose([
      makeLayer(pulsingHypotrochoid(0.64, 0.16, 1.2, 0.6), LIME, {
        lineWidth: 1.9,
        glow: 1.1,
        count: 900,
        tracer: createFirefly(0, { x: 0, y: 0 }, { size: 0.05 }),
        // The curve peaks at ~0.4 world units, so a narrow world width keeps
        // the glow halo crisp instead of flooding the whole card after auto-fit.
        trail: createVanishingGlow(LIME, { capacity: 120, baseOpacity: 0.3, widthWorld: 0.05 }),
      }),
      makeLayer(pulsingHypotrochoid(0.64, 0.16, 1.2, 0.6), TEAL, {
        transform: { rotation: 1.1 },
        lineWidth: 1.2,
        glow: 0.8,
        count: 900,
        trail: createOrbitTrace(TEAL, { capacity: 100, baseOpacity: 0.35 }),
      }),
    ]),
    universe: createDeepOcean(),
    tracerSpeed: 0.32,
    tracerLoops: true,
  });
}

export const logPulsing: MathVersoEntry = {
  id: "log_pulsing",
  name: "Pulsation logarithmique",
  family: "orbital",
  description: "Hypotrochoïde qui respire sur deep_ocean.",
  create: createLogPulsing,
};