/**
 * "rose_garden" — first demonstration scene for the Math Verso Engine.
 *
 * A calm rose curve (rhodonea, k=5) drawn in warm gold on a deep indigo
 * universe. A luminous tracer rides the curve, leaving a fading trail.
 * The reference frame is shown to demonstrate the coordinate system.
 *
 * This scene is intentionally simple: its purpose is to prove the
 * architecture works end-to-end (universe + frame + composition + tracer
 * + trail + lifecycle), not to be a final artistic composition.
 */

import type { VersoAnimationDefinition } from "../../types";
import type { CurveLayer, MathComposition, Universe } from "../types";
import { rose } from "../functions";
import { sampleCurve } from "../sampling";
import { CurveTracer } from "../tracer";
import { FadingPolylineTrail } from "../trail";
import { createMidnightObservatory } from "../universes";
import { MathScene } from "../scene";

const ROSE_COLOR = "#f4c87a";
const ROSE_GLOW = "#ffd9a0";

function buildComposition(): MathComposition {
  const spec = rose(5);
  const curve = sampleCurve(spec.fn, { domain: spec.domain, count: 400 }, spec.closed);
  const layer: CurveLayer = {
    id: "rose",
    curve,
    color: ROSE_COLOR,
    lineWidth: 1.8,
    glow: 1,
  };
  return { layers: [layer] };
}

export function createRoseGardenScene(
  universeFactory: () => Universe = createMidnightObservatory,
): MathScene {
  const composition = buildComposition();
  const tracer = new CurveTracer(0, { x: 0, y: 0 }, { size: 0.07 });
  const trail = new FadingPolylineTrail(ROSE_GLOW, {
    capacity: 80,
    baseOpacity: 0.6,
    width: 2,
  });
  const universe = universeFactory();

  return new MathScene({
    id: "rose_garden",
    composition,
    tracer,
    trail,
    universe,
    tracerSpeed: 0.35,
    tracerLoops: true,
  });
}

export const roseGardenAnimation: VersoAnimationDefinition = {
  id: "rose_garden",
  create: () => createRoseGardenScene(),
};
