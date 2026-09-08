/**
 * "shockwave_crystal" — sawtooth shockwave crystal, parametric family.
 *
 * Polar radius r=R0+A·asin(sin(k·φ)) with R0=0.45, A=0.28, k=8: the soft
 * triangle wave (asin∘sin) produces eight hard, faceted "spikes" like a
 * crystal refracting an incoming shock front. Two counter-rotated copies
 * plus a slow ember tracer on the ember-void sky.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createEmberVoid } from "../../universes";
import { createRoseSpark } from "../../tracers/roseSpark";
import { createSparkFragment } from "../../trails/sparkFragment";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";

const EMBER = "#ffb27a";
const CORAL = "#ff7f4f";
const PALE = "#ffe0b0";

function shockwave(R0: number, A: number, k: number, phase: number): CurveSpec {
  return {
    id: "shockwave_crystal",
    fn: (t) => {
      const r = R0 + A * Math.asin(Math.sin(k * t + phase));
      return {
        x: r * Math.cos(t),
        y: r * Math.sin(t),
      };
    },
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Onde polaire en dents de scie adoucie.",
  };
}

export function createShockwaveCrystal(): MathScene {
  return new MathScene({
    id: "shockwave_crystal",
    composition: compose([
      makeLayer(shockwave(0.45, 0.28, 8, 0), EMBER, {
        lineWidth: 1.7,
        glow: 1.5,
        count: 700,
        tracer: createRoseSpark(0, { x: 0.4, y: 0 }, { size: 0.055 }),
        trail: createSparkFragment(EMBER, { capacity: 80, baseOpacity: 0.5 }),
      }),
      makeLayer(shockwave(0.45, 0.28, 8, Math.PI / 8), CORAL, {
        transform: { rotation: 0.5, scale: 0.8 },
        lineWidth: 1.1,
        glow: 0.9,
        count: 700,
        trail: createFadingLine(CORAL, { capacity: 80, baseOpacity: 0.35, width: 1 }),
      }),
      makeLayer(shockwave(0.45, 0.28, 8, -Math.PI / 8), PALE, {
        transform: { scale: 1.14 },
        lineWidth: 0.9,
        glow: 0.6,
        count: 700,
      }),
    ]),
    universe: createEmberVoid(),
    tracerSpeed: 0.4,
    tracerLoops: true,
  });
}

export const shockwaveCrystal: MathVersoEntry = {
  id: "shockwave_crystal",
  name: "Cristal d'onde de choc",
  family: "parametric",
  description: "Onde de choc facettée en cristal sur ember_void.",
  create: createShockwaveCrystal,
};