/**
 * "quantum_lace" — modulated Lissajous lace, parametric family.
 *
 * x(t)=cos(at)·(1+d·cos(ct)), y(t)=sin(bt)·(1+d·cos(ct)) with a=3, b=4,
 * c=16, d=0.25. Three nested copies (different sizes and axes) weave a
 * delicate, jewellery-like lace over the violet-dream sky.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createVioletDream } from "../../universes";
import { createLuminousPointTracer } from "../../tracers/luminousPoint";
import { createLightEcho } from "../../trails/lightEcho";
import { createMistTrail } from "../../trails/mistTrail";
import { makeLayer, compose } from "./helpers";

const VIOLET = "#d4a6ff";
const AZURE = "#9ad0ff";
const ROSE = "#ff9fbb";

function laceCurve(a: number, b: number, c: number, d: number): CurveSpec {
  return {
    id: "quantum_lace",
    fn: (t) => {
      const q = 1 + d * Math.cos(c * t);
      return {
        x: Math.cos(a * t) * q,
        y: Math.sin(b * t) * q,
      };
    },
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Lissajous lace with amplitude modulation.",
  };
}

export function createQuantumLace(): MathScene {
  return new MathScene({
    id: "quantum_lace",
    composition: compose([
      makeLayer(laceCurve(3, 4, 16, 0.25), VIOLET, {
        lineWidth: 1.6,
        glow: 1.3,
        count: 700,
        tracer: createLuminousPointTracer(0, { x: 0, y: 0 }, { size: 0.055, color: VIOLET }),
        trail: createLightEcho(VIOLET, { capacity: 36, baseOpacity: 0.4 }),
      }),
      makeLayer(laceCurve(3, 4, 16, 0.25), AZURE, {
        transform: { rotation: Math.PI / 6, scale: 0.86 },
        lineWidth: 1.2,
        glow: 0.9,
        count: 700,
        trail: createMistTrail(AZURE, { capacity: 40, baseOpacity: 0.3 }),
      }),
      makeLayer(laceCurve(3, 4, 16, 0.25), ROSE, {
        transform: { rotation: -Math.PI / 5, scale: 0.64 },
        lineWidth: 1,
        glow: 0.7,
        count: 700,
      }),
    ]),
    universe: createVioletDream(),
    tracerSpeed: 0.3,
    tracerLoops: true,
  });
}

export const quantumLace: MathVersoEntry = {
  id: "quantum_lace",
  name: "Dentelle quantique",
  family: "parametric",
  description: "Lissajous modulé tissé en dentelle sur violet_dream.",
  create: createQuantumLace,
};