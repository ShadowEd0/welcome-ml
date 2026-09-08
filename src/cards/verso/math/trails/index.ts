import { createFadingLine } from "./fadingLine";
import { createGoldenDust } from "./goldenDust";
import { createSilkRibbon } from "./silkRibbon";
import { createInkTrace } from "./inkTrace";
import { createLightEcho } from "./lightEcho";
import { createSparkFragment } from "./sparkFragment";
import { createMistTrail } from "./mistTrail";
import { createCrystalTrace } from "./crystalTrace";
import { createOrbitTrace } from "./orbitTrace";
import { createVanishingGlow } from "./vanishingGlow";

export {
  createFadingLine,
  createGoldenDust,
  createSilkRibbon,
  createInkTrace,
  createLightEcho,
  createSparkFragment,
  createMistTrail,
  createCrystalTrace,
  createOrbitTrace,
  createVanishingGlow,
};

export const TRAIL_FACTORIES = {
  fading_line: createFadingLine,
  golden_dust: createGoldenDust,
  silk_ribbon: createSilkRibbon,
  ink_trace: createInkTrace,
  light_echo: createLightEcho,
  spark_fragment: createSparkFragment,
  mist_trail: createMistTrail,
  crystal_trace: createCrystalTrace,
  orbit_trace: createOrbitTrace,
  vanishing_glow: createVanishingGlow,
} as const;

export type TrailKind = keyof typeof TRAIL_FACTORIES;

export function createTrail(kind: TrailKind, color: string, options?: Record<string, unknown>) {
  const factory = TRAIL_FACTORIES[kind];
  return factory(color, options as never);
}

export function listTrailIds(): readonly TrailKind[] {
  return Object.keys(TRAIL_FACTORIES) as TrailKind[];
}