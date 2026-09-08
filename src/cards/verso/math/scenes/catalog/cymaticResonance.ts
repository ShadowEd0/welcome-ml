/**
 * "cymatic_resonance" — Chladni resonance rings, geometric family.
 *
 * Polar ring system r(φ)=R0 + A·cos(n·φ)·sin(m·φ) with n=4, m=8 and a
 * radial compression k≈0.3, rendered as several concentric bands of
 * different radius/phase — like vibration patterns on a plate, in calm
 * aqua light and shadow.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createCalmAqua } from "../../universes";
import { createMoonPearl } from "../../tracers/moonPearl";
import { createFadingLine } from "../../trails/fadingLine";
import { createOrbitTrace } from "../../trails/orbitTrace";
import { makeLayer, compose } from "./helpers";

const AQUA = "#9fdbef";
const TEAL = "#5fb9d8";
const MINT = "#c8f0e6";

function chladni(R0: number, A: number, n: number, m: number, k: number, phase: number): CurveSpec {
  return {
    id: "chladni_ring",
    fn: (t) => {
      const amp = A * (1 - k * (R0 / 1.1));
      const r = R0 + amp * Math.cos(n * t + phase) * Math.sin(m * t + phase);
      return {
        x: r * Math.cos(t),
        y: r * Math.sin(t),
      };
    },
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Chladni-style modulated ring.",
  };
}

export function createCymaticResonance(): MathScene {
  return new MathScene({
    id: "cymatic_resonance",
    composition: compose([
      makeLayer(chladni(0.82, 0.2, 4, 8, 0.3, 0), AQUA, {
        lineWidth: 3.2,
        glow: 2.6,
        count: 720,
        tracer: createMoonPearl(0, { x: 0.8, y: 0 }, { size: 0.055 }),
        trail: createFadingLine(AQUA, { capacity: 220, baseOpacity: 0.9, width: 3 }),
        reveal: { duration: 3.8 },
      }),
      makeLayer(chladni(0.82, 0.2, 4, 8, 0.3, 0.35), TEAL, {
        transform: { rotation: 0.3 },
        lineWidth: 2,
        glow: 1.5,
        count: 720,
        reveal: { delay: 0.2, duration: 2.6 },
      }),
      makeLayer(chladni(0.62, 0.17, 4, 8, 0.3, 0.7), MINT, {
        transform: { rotation: -0.45 },
        lineWidth: 1.7,
        glow: 1.2,
        count: 720,
        reveal: { delay: 0.4, duration: 2.6 },
      }),
      makeLayer(chladni(0.36, 0.12, 4, 8, 0.3, 1.4), TEAL, {
        transform: { rotation: 0.2 },
        lineWidth: 1.3,
        glow: 0.9,
        count: 720,
      }),
      makeLayer(chladni(1.02, 0.26, 6, 9, 0.32, 0), AQUA, {
        transform: { rotation: 0.7 },
        lineWidth: 1.1,
        glow: 0.8,
        count: 720,
        trail: createOrbitTrace(AQUA, { capacity: 60, baseOpacity: 0.28 }),
        reveal: { delay: 0.5, duration: 3 },
      }),
    ]),
    universe: createCalmAqua(),
    tracerSpeed: 0.35,
    tracerLoops: true,
  });
}

export const cymaticResonance: MathVersoEntry = {
  id: "cymatic_resonance",
  name: "Résonance cymatique",
  family: "geometric",
  description: "Anneaux de Chladni superposés sur calm_aqua.",
  create: createCymaticResonance,
};