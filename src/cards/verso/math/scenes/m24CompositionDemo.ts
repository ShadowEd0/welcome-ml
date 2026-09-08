/**
 * M24 — Composition engine demonstration scenes.
 *
 * These scenes exist to VALIDATE the multi-curve composition engine of M24:
 * multiple CurveLayers drawn together in a single shared world, each layer
 * with its own transform / style / tracer / trail.
 *
 * IMPORTANT: These are architecture tests, NOT any of the 10 final M25
 * versos. They deliberately exercise the engine rather than polish an
 * artistic composition.
 */

import type { VersoAnimationDefinition } from "../../types";
import type { CurveLayer, MathComposition, Tracer, Trail } from "../types";
import { rose, circle, lissajous, ellipse, heart, spiral, waveOrbit } from "../functions";
import { sampleCurve } from "../sampling";
import { MathScene } from "../scene";
import { createMidnightObservatory } from "../universes";
import { createLuminousPointTracer } from "../tracers/luminousPoint";
import { createRoseSpark } from "../tracers/roseSpark";
import { createOrbitingMote } from "../tracers/orbitingMote";
import { createFadingLine } from "../trails/fadingLine";
import { createSilkRibbon } from "../trails/silkRibbon";
import { createCrystalTrace } from "../trails/crystalTrace";
import { createGoldenDust } from "../trails/goldenDust";
import { createInkTrace } from "../trails/inkTrace";
import { createLightEcho } from "../trails/lightEcho";
import type { CurveSpec } from "../types";

const ROT_0 = 0;
const ROT_45 = Math.PI / 4;
const ROT_90 = Math.PI / 2;
const ROT_135 = (3 * Math.PI) / 4;

/**
 * A single rose function, reused across four layers with four different
 * rotations. Proves that one pure function can compose several transformed
 * layers without duplication.
 */
function roseLayer(
  id: string,
  rotation: number,
  color: string,
  tracer: (t0: number) => Tracer,
  trail: Trail,
): CurveLayer {
  const spec = rose(5);
  const curve = sampleCurve(spec.fn, { domain: spec.domain, count: 400 }, spec.closed);
  return {
    id,
    curve,
    color,
    lineWidth: 1.4,
    glow: 1,
    transform: { rotation },
    tracer: tracer(0),
    trail,
  };
}

/** Primary demo: rose × 4, rotations 0° / 45° / 90° / 135°. */
export function createRoseRotationDemo(): MathScene {
  const gold = roseLayer("rose_0", ROT_0, "#f4c87a",
    (t0) => createLuminousPointTracer(t0, { x: 0, y: 0 }, { size: 0.05, color: "#f4c87a" }),
    createFadingLine("#f4c87a", { capacity: 70, baseOpacity: 0.55, width: 1.4 }));
  const violet = roseLayer("rose_45", ROT_45, "#c9a0ff",
    (t0) => createLuminousPointTracer(t0, { x: 0, y: 0 }, { size: 0.05, color: "#c9a0ff" }),
    createSilkRibbon("#c9a0ff", { capacity: 60, baseOpacity: 0.5 }));
  const rose = roseLayer("rose_90", ROT_90, "#ff9ec4",
    (t0) => createRoseSpark(t0, { x: 0, y: 0 }, { size: 0.055 }),
    createCrystalTrace("#ff9ec4", { capacity: 50, baseOpacity: 0.5 }));
  const teal = roseLayer("rose_135", ROT_135, "#7fd8c8",
    (t0) => createOrbitingMote(t0, { x: 0, y: 0 }, { size: 0.055 }),
    createFadingLine("#7fd8c8", { capacity: 60, baseOpacity: 0.5, width: 1.2 }));

  const composition: MathComposition = { layers: [gold, violet, rose, teal] };

  // Same tracerSpeed drives every layer tracer (they all share it).
  return new MathScene({
    id: "m24_rose_rotations",
    composition,
    universe: createMidnightObservatory(),
    tracerSpeed: 0.25,
    tracerLoops: true,
  });
}

export const m24RoseRotationAnimation: VersoAnimationDefinition = {
  id: "m24_rose_rotations",
  create: () => createRoseRotationDemo(),
};

function layer(
  id: string,
  spec: CurveSpec,
  color: string,
  transform: NonNullable<CurveLayer["transform"]> | undefined,
  trail: Trail,
  count = 400,
): CurveLayer {
  const curve = sampleCurve(spec.fn, { domain: spec.domain, count }, spec.closed);
  return { id, curve, color, lineWidth: 1.3, glow: 1, transform, trail };
}

function composer(
  id: string,
  layers: CurveLayer[],
  speed: number,
  loops = true,
): MathScene {
  return new MathScene({
    id,
    composition: { layers },
    universe: createMidnightObservatory(),
    tracerSpeed: speed,
    tracerLoops: loops,
  });
}

// --- A: rose + circle (different curve families overlaid) ---
export function createRoseCircleDemo(): MathScene {
  const roseL = layer("rose", rose(3), "#f4c87a", undefined,
    createGoldenDust("#f4c87a", { capacity: 60, baseOpacity: 0.55 }));
  const circleL = layer("circle", circle(0.85), "#9fb8ff", undefined,
    createInkTrace("#9fb8ff", { capacity: 50, baseOpacity: 0.5 }));
  return composer("m24_rose_circle", [roseL, circleL], 0.3);
}
export const m24RoseCircleAnimation: VersoAnimationDefinition = {
  id: "m24_rose_circle",
  create: () => createRoseCircleDemo(),
};

// --- B: lissajous + ellipse (parametric families) ---
export function createLissajousEllipseDemo(): MathScene {
  const lissL = layer("lissajous", lissajous(3, 2), "#ff9ec4", undefined,
    createSilkRibbon("#ff9ec4", { capacity: 60, baseOpacity: 0.5 }));
  const ellL = layer("ellipse", ellipse(0.9, 0.9), "#b3ffb3", { rotation: Math.PI / 6 },
    createFadingLine("#b3ffb3", { capacity: 55, baseOpacity: 0.5, width: 1.2 }));
  return composer("m24_lissajous_ellipse", [lissL, ellL], 0.4);
}
export const m24LissajousEllipseAnimation: VersoAnimationDefinition = {
  id: "m24_lissajous_ellipse",
  create: () => createLissajousEllipseDemo(),
};

// --- C: heart + orbit ---
export function createHeartOrbitDemo(): MathScene {
  const heartL = layer("heart", heart(1), "#ff7a7a", undefined,
    createCrystalTrace("#ff7a7a", { capacity: 50, baseOpacity: 0.5 }));
  const orbitL = layer("orbit", waveOrbit(1.3, 0.1, 3), "#9fd0ff", { rotation: Math.PI / 3 },
    createLightEcho("#9fd0ff", { capacity: 30, baseOpacity: 0.45 }));
  return composer("m24_heart_orbit", [heartL, orbitL], 0.3);
}
export const m24HeartOrbitAnimation: VersoAnimationDefinition = {
  id: "m24_heart_orbit",
  create: () => createHeartOrbitDemo(),
};

// --- D: spiral + circle + wave_orbit ---
export function createSpiralCircleWaveDemo(): MathScene {
  const spiralL = layer("spiral", spiral(0.05, 0.35, 3), "#f4c87a", undefined,
    createFadingLine("#f4c87a", { capacity: 80, baseOpacity: 0.6, width: 1.2 }), 500);
  const circleL = layer("circle", circle(0.6), "#9fb8ff", undefined,
    createGoldenDust("#9fb8ff", { capacity: 50, baseOpacity: 0.5 }));
  const waveL = layer("wave_orbit", waveOrbit(1, 0.15, 4), "#ff9ec4", { rotation: Math.PI / 4 },
    createSilkRibbon("#ff9ec4", { capacity: 55, baseOpacity: 0.5 }));
  return composer("m24_spiral_circle_wave", [spiralL, circleL, waveL], 0.5, false);
}
export const m24SpiralCircleWaveAnimation: VersoAnimationDefinition = {
  id: "m24_spiral_circle_wave",
  create: () => createSpiralCircleWaveDemo(),
};
