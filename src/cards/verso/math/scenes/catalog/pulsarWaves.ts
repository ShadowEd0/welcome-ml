/**
 * "pulsar_waves" — frequency-modulated trochoid waves, parametric family.
 *
 * A classic hypotrochoid whose angular parameter carries a slow FM wobble:
 * φ(t)=t + I·sin(fmod·t) with I≈1.5, fmod≈12, so the tight loops breathe
 * like a pulsar's pulse. Warm ember palette on the ember-void backdrop.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createEmberVoid } from "../../universes";
import { createCometSpark } from "../../tracers/cometSpark";
import { createGoldenDust } from "../../trails/goldenDust";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";

const AMBER = "#ffd9a0";
const CORAL = "#ff9e6b";
const GOLD = "#ffc163";

function pulsarTrochoid(R: number, r: number, I: number, fmod: number, phase: number): CurveSpec {
  return {
    id: "pulsar_trochoid",
    fn: (t) => {
      const phi = t + I * Math.sin(fmod * t) + phase;
      const x = (R - r) * Math.cos(t) + r * Math.cos(phi);
      const y = (R - r) * Math.sin(t) - r * Math.sin(phi);
      return { x: x * 0.42, y: y * 0.42 };
    },
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Trochoïde à modulation de fréquence.",
  };
}

export function createPulsarWaves(): MathScene {
  return new MathScene({
    id: "pulsar_waves",
    composition: compose([
      makeLayer(pulsarTrochoid(0.82, 0.92, 1.5, 12, 0), AMBER, {
        lineWidth: 1.5,
        glow: 1.3,
        count: 900,
        tracer: createCometSpark(0, { x: 0, y: 0 }, { size: 0.05 }),
        trail: createGoldenDust(AMBER, { capacity: 90, baseOpacity: 0.6 }),
      }),
      makeLayer(pulsarTrochoid(0.82, 0.92, 1.5, 12, 0.8), CORAL, {
        transform: { rotation: 0.9 },
        lineWidth: 1.1,
        glow: 0.9,
        count: 900,
        trail: createFadingLine(CORAL, { capacity: 90, baseOpacity: 0.35, width: 1 }),
      }),
      makeLayer(pulsarTrochoid(0.82, 0.92, 1.5, 12, -0.8), GOLD, {
        transform: { rotation: -0.9 },
        lineWidth: 0.9,
        glow: 0.7,
        count: 900,
      }),
    ]),
    universe: createEmberVoid(),
    tracerSpeed: 0.38,
    tracerLoops: true,
  });
}

export const pulsarWaves: MathVersoEntry = {
  id: "pulsar_waves",
  name: "Ondes de pulsar",
  family: "parametric",
  description: "Trochoïde à FM ondoyante sur ember_void.",
  create: createPulsarWaves,
};