/**
 * "crystal_maurer" — Maurer rose crystal, geometric family.
 *
 * r(t)=sin(n·θ) with θ=t·d° (n=6, d=29): a polygonal lattice that reads
 * like a cut gem. Three nestings on the frozen void-ice backdrop, cut by
 * a slowly advancing crystal tracer leaving crystalline segments.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createVoidIce } from "../../universes";
import { createCrystalDrop } from "../../tracers/crystalDrop";
import { createCrystalTrace } from "../../trails/crystalTrace";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";

const ICE = "#d8efff";
const AZURE = "#8ec9ff";
const WHITE = "#ffffff";

function maurerRose(n: number, d: number): CurveSpec {
  return {
    id: "maurer_rose",
    fn: (t) => {
      const theta = (Math.PI / 180) * d * t;
      const r = Math.sin(n * theta);
      return {
        x: r * Math.cos(theta),
        y: r * Math.sin(theta),
      };
    },
    domain: { min: 0, max: 360 },
    closed: true,
    description: "Maurer rose lattice.",
  };
}

export function createCrystalMaurer(): MathScene {
  return new MathScene({
    id: "crystal_maurer",
    composition: compose([
      makeLayer(maurerRose(6, 29), ICE, {
        lineWidth: 1.5,
        glow: 1.2,
        count: 900,
        tracer: createCrystalDrop(0, { x: 0, y: 0 }, { size: 0.06 }),
        trail: createCrystalTrace(ICE, { capacity: 40, baseOpacity: 0.5 }),
      }),
      makeLayer(maurerRose(6, 31), AZURE, {
        transform: { rotation: 0.35, scale: 0.56 },
        lineWidth: 1.1,
        glow: 0.9,
        count: 900,
        trail: createFadingLine(AZURE, { capacity: 60, baseOpacity: 0.3, width: 1 }),
      }),
      makeLayer(maurerRose(6, 25), WHITE, {
        transform: { rotation: -0.3, scale: 0.28 },
        lineWidth: 0.9,
        glow: 0.6,
        count: 900,
      }),
    ]),
    universe: createVoidIce(),
    tracerSpeed: 0.42,
    tracerLoops: true,
  });
}

export const crystalMaurer: MathVersoEntry = {
  id: "crystal_maurer",
  name: "Cristal de Maurer",
  family: "geometric",
  description: "Rose de Maurer facettée en cristal sur void_ice.",
  create: createCrystalMaurer,
};