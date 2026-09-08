/**
 * "gielis_shield" — superformula shield, floral family.
 *
 * Gielis superformula r(φ) with m=6, n1=0.5, n2=1.7, n3=1.7. Four nested
 * layers on different scales slide through each other like layered leaves
 * of an otherworldly shield-flower, on the arctic-silence night.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createArcticSilence } from "../../universes";
import { createRoseSpark } from "../../tracers/roseSpark";
import { createSparkFragment } from "../../trails/sparkFragment";
import { createFadingLine } from "../../trails/fadingLine";
import { makeLayer, compose } from "./helpers";

const SILVER = "#e8edf4";
const ROSE = "#ffcedb";
const GOLD = "#ffe0b8";
const TEAL = "#bfe9dd";

function superformula(m: number, n1: number, n2: number, n3: number): (t: number) => { x: number; y: number } {
  return (t) => {
    const ang = (m * t) / 4;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const term = Math.pow(
      Math.pow(Math.abs(c), n2) + Math.pow(Math.abs(s), n3),
      -1 / n1
    );
    return { x: term * Math.cos(t), y: term * Math.sin(t) };
  };
}

function shield(scale: number, m: number, n1: number, n2: number, n3: number): CurveSpec {
  const f = superformula(m, n1, n2, n3);
  return {
    id: "gielis_shield",
    fn: (t) => {
      const p = f(t);
      return { x: p.x * scale, y: p.y * scale };
    },
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Superformule de Gielis.",
  };
}

export function createGielisShield(): MathScene {
  return new MathScene({
    id: "gielis_shield",
    composition: compose([
      makeLayer(shield(0.72, 6, 0.5, 1.7, 1.7), SILVER, {
        lineWidth: 1.5,
        glow: 1.2,
        count: 900,
        tracer: createRoseSpark(0, { x: 0.7, y: 0 }, { size: 0.05 }),
        trail: createSparkFragment(SILVER, { capacity: 70, baseOpacity: 0.45 }),
        reveal: { duration: 3.8 },
      }),
      makeLayer(shield(0.5, 6, 0.5, 1.7, 1.7), ROSE, {
        transform: { rotation: 0.55 },
        lineWidth: 1.1,
        glow: 0.9,
        count: 900,
        trail: createFadingLine(ROSE, { capacity: 90, baseOpacity: 0.3, width: 1 }),
      }),
      makeLayer(shield(0.5, 6, 0.5, 1.7, 1.7), GOLD, {
        transform: { rotation: -0.55 },
        lineWidth: 1,
        glow: 0.8,
        count: 900,
      }),
      makeLayer(shield(0.28, 6, 0.5, 1.7, 1.7), TEAL, {
        lineWidth: 0.9,
        glow: 0.6,
        count: 900,
      }),
    ]),
    universe: createArcticSilence(),
    tracerSpeed: 0.36,
    tracerLoops: true,
  });
}

export const gielisShield: MathVersoEntry = {
  id: "gielis_shield",
  name: "Bouclier de Gielis",
  family: "floral",
  description: "Superformule feuilletée sur arctic_silence.",
  create: createGielisShield,
};