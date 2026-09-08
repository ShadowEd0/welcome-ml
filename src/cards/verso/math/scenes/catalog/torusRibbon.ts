/**
 * "torus_ribbon" — frequency-modulated torus ribbon, geometric family.
 *
 * A curve wound around a torus silhouette: R·(cos t, sin t) with the tube
 * radius r(t)=r0+r1·cos(n·t), n≈18. The ribbon looks like a helical coil
 * pinned at the poles of a hula hoop — a bright hot gold thread on the
 * polished black mirror.
 */

import type { MathVersoEntry } from "../../catalog";
import type { CurveSpec } from "../../types";
import { MathScene } from "../../scene";
import { createBlackMirror } from "../../universes";
import { createCometSpark } from "../../tracers/cometSpark";
import { createFadingLine } from "../../trails/fadingLine";
import { createLightEcho } from "../../trails/lightEcho";
import { makeLayer, compose } from "./helpers";

const GOLD = "#ffd9a0";
const CORAL = "#ffb877";
const CREAM = "#fff0c8";

function ribbonCurve(R: number, r0: number, r1: number, n: number, phase: number): CurveSpec {
  return {
    id: "torus_ribbon",
    fn: (t) => {
      const tube = r0 + r1 * Math.cos(n * t + phase);
      return {
        x: (R + tube) * Math.cos(t),
        y: (R + tube) * Math.sin(t),
      };
    },
    domain: { min: 0, max: Math.PI * 2 },
    closed: true,
    description: "Ruban enroulé sur un tore.",
  };
}

export function createTorusRibbon(): MathScene {
  return new MathScene({
    id: "torus_ribbon",
    composition: compose([
      makeLayer(ribbonCurve(0.62, 0.24, 0.3, 18, 0), GOLD, {
        lineWidth: 1.6,
        glow: 1.4,
        count: 1000,
        tracer: createCometSpark(0, { x: 0, y: 0 }, { size: 0.05 }),
        trail: createFadingLine(GOLD, { capacity: 130, baseOpacity: 0.45, width: 1.2 }),
      }),
      makeLayer(ribbonCurve(0.62, 0.24, 0.3, 18, Math.PI / 2), CORAL, {
        transform: { rotation: 0.4 },
        lineWidth: 1,
        glow: 0.8,
        count: 1000,
        trail: createLightEcho(CORAL, { capacity: 30, baseOpacity: 0.35 }),
      }),
      makeLayer(ribbonCurve(0.62, 0.24, 0.3, 18, Math.PI), CREAM, {
        lineWidth: 0.8,
        glow: 0.6,
        count: 1000,
      }),
    ]),
    universe: createBlackMirror(),
    tracerSpeed: 0.42,
    tracerLoops: true,
  });
}

export const torusRibbon: MathVersoEntry = {
  id: "torus_ribbon",
  name: "Ruban torique",
  family: "geometric",
  description: "Ruban enroulé sur un tore sur black_mirror.",
  create: createTorusRibbon,
};