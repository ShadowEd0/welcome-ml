/**
 * "fermat_vortex" — Fermat spiral vortex, orbital family.
 *
 * r=a·√t (Fermat spiral) cut into two opposing arms and overlaid with a
 * fresh radial perturbation dr←sin(k·t+φ) to give each arm life. Two
 * counter-rotating spirals form a calm cosmic womb, drawn in rose silks on
 * the plum-hour tones of rose_cosmos.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createRoseCosmos } from "../../universes";
import { createVioletFlame } from "../../tracers/violetFlame";
import { createSilkRibbon } from "../../trails/silkRibbon";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";

const ROSE = "#ffc1d4";
const MAGENTA = "#e39ac1";
const LILAC = "#cfaeff";
const GOLDEN = 2.399963229728653; // golden angle

function fermatArm(a: number, seedOffset: number, dir: 1 | -1): CurveSpec {
  const seed = seedOffset % 1;
  return {
    id: "fermat_arm",
    fn: (t) => {
      const u = t * 0.5 + seed;
      const r = a * Math.sqrt(u);
      const theta = GOLDEN * u * dir;
      const pert = r * 0.035 * Math.sin(7 * u + seedOffset * 3);
      return {
        x: (r + pert) * Math.cos(theta),
        y: (r + pert) * Math.sin(theta),
      };
    },
    domain: { min: 0, max: 1.9 },
    closed: false,
    description: "Spirale de Fermat (une aile).",
  };
}

export function createFermatVortex(): MathScene {
  return new MathScene({
    id: "fermat_vortex",
    composition: compose([
      makeLayer(fermatArm(0.5, 0.0, 1), ROSE, {
        lineWidth: 1.5,
        glow: 1.2,
        count: 700,
        // The spiral reaches ~0.7; auto-fit keeps the whole scene compact.
        tracer: createVioletFlame(0, { x: 0, y: 0 }, { size: 0.06 }),
        trail: createSilkRibbon(ROSE, { capacity: 130, baseOpacity: 0.45 }),
        reveal: { duration: 3.8 },
      }),
      makeLayer(fermatArm(0.5, 0.12, -1), MAGENTA, {
        transform: { rotation: 0.6 },
        lineWidth: 1.1,
        glow: 0.9,
        count: 700,
        trail: createFadingLine(MAGENTA, { capacity: 100, baseOpacity: 0.32, width: 1 }),
        reveal: { delay: 0.35 },
      }),
      makeLayer(fermatArm(0.5, 0.5, 1), LILAC, {
        transform: { rotation: Math.PI, scale: 0.5 },
        lineWidth: 0.9,
        glow: 0.6,
        count: 600,
      }),
    ]),
    universe: createRoseCosmos(),
    tracerSpeed: 0.5,
    tracerLoops: false,
  });
}

export const fermatVortex: MathVersoEntry = {
  id: "fermat_vortex",
  name: "Vortex de Fermat",
  family: "orbital",
  description: "Double spirale de Fermat sur rose_cosmos.",
  create: createFermatVortex,
};