/**
 * "spirokinetic" — layered hypotrochoids, parametric family.
 *
 * Two hypotrochoid spirographs of different period, one rotated, interlace
 * a calm, icy pattern on the arctic-silence sky. Icy blues with a
 * crystal-drop tracer and a fading-line trail.
 */

import type { MathVersoEntry } from "../../catalog";
import { hypotrochoid } from "../../functions";
import { MathScene } from "../../scene";
import { createArcticSilence } from "../../universes";
import { createCrystalDrop } from "../../tracers/crystalDrop";
import { createLuminousPointTracer } from "../../tracers/luminousPoint";
import { createFadingLine } from "../../trails/fadingLine";
import { createSilkRibbon } from "../../trails/silkRibbon";
import { makeLayer, compose } from "./helpers";

const ICE = "#c8ecff";
const FROST = "#9cc6ea";

export function createSpirokinetic(): MathScene {
  return new MathScene({
    id: "spirokinetic",
    composition: compose([
      makeLayer(hypotrochoid(5, 3, 2), ICE, {
        lineWidth: 1.5,
        glow: 1.3,
        count: 700,
        tracer: createCrystalDrop(0, { x: 0, y: 0 }, { size: 0.05 }),
        trail: createFadingLine(ICE, { capacity: 60, baseOpacity: 0.45, width: 1.2 }),
      }),
      makeLayer(hypotrochoid(5, 4, 2), FROST, {
        transform: { rotation: Math.PI / 3 },
        lineWidth: 1.1,
        glow: 0.8,
        count: 700,
        tracer: createLuminousPointTracer(0, { x: 0, y: 0 }, { size: 0.04, color: FROST }),
        trail: createSilkRibbon(FROST, { capacity: 50, baseOpacity: 0.4 }),
      }),
    ]),
    universe: createArcticSilence(),
    tracerSpeed: 0.3,
    tracerLoops: true,
  });
}

export const spirokinetic: MathVersoEntry = {
  id: "spirokinetic",
  name: "Spirokinétic",
  family: "parametric",
  description: "Hypotrochoïdes emboîtées et glaciaires sur arctic_silence.",
  create: createSpirokinetic,
};
