/**
 * "rational_lens" — rational cycloidal lens, geometric family.
 *
 * A rational parametrization p(t)=(cos t + a·cos(n·t), sin t − a·sin(n·t))
 * grown in scale by 1/(1+b·sin(m·t)) with a=0.22, b=0.45, n=2, m=3. The
 * denominator is always positive (∈[0.55, 1.45]) so the curve stays a
 * smooth, well-defined lens rosette — like four drops of water caught in
 * one breath of light.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createCalmAqua } from "../../universes";
import { createPrismShard } from "../../tracers/prismShard";
import { createLightEcho } from "../../trails/lightEcho";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";
import { circle } from "../../functions";

function lensCurve(a: number, b: number, n: number, m: number, phase: number): CurveSpec {
  const S = 0.45;
  return {
    id: "rational_lens",
    fn: (t) => {
      const th = t + phase;
      const den = 1 + b * Math.sin(m * th);
      const x = (Math.cos(th) + a * Math.cos(n * th)) / den;
      const y = (Math.sin(th) - a * Math.sin(n * th)) / den;
      return { x: x * S, y: y * S };
    },
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Cycloïde rationnelle à dénominateur strictement positif.",
  };
}

export function createRationalLens(): MathScene {
  return new MathScene({
    id: "rational_lens",
    composition: compose([
      makeLayer(lensCurve(0.22, 0.45, 2, 3, 0), "#aeedf2", {
        lineWidth: 1.5,
        glow: 1.3,
        count: 900,
        tracer: createPrismShard(0, { x: 0, y: 0 }, { size: 0.07 }),
        trail: createFadingLine("#aeedf2", { capacity: 100, baseOpacity: 0.4, width: 1.2 }),
      }),
      makeLayer(lensCurve(0.22, 0.45, 2, 3, Math.PI / 2), "#77cce0", {
        transform: { rotation: Math.PI / 2 },
        lineWidth: 1,
        glow: 0.8,
        count: 900,
        trail: createLightEcho("#77cce0", { capacity: 32, baseOpacity: 0.35 }),
      }),
      makeLayer(circle(0.14), "#e2f9fb", {
        lineWidth: 1,
        glow: 0.7,
      }),
    ]),
    universe: createCalmAqua(),
    tracerSpeed: 0.36,
    tracerLoops: true,
  });
}

export const rationalLens: MathVersoEntry = {
  id: "rational_lens",
  name: "Lentille rationnelle",
  family: "geometric",
  description: "Cycloïde rationnelle en rosette sur calm_aqua.",
  create: createRationalLens,
};