import { createLuminousPointTracer } from "./luminousPoint";
import { createGoldenSeedTracer } from "./goldenSeed";
import { createCometSpark } from "./cometSpark";
import { createCrystalDrop } from "./crystalDrop";
import { createFirefly } from "./firefly";
import { createMoonPearl } from "./moonPearl";
import { createVioletFlame } from "./violetFlame";
import { createOrbitingMote } from "./orbitingMote";
import { createPrismShard } from "./prismShard";
import { createRoseSpark } from "./roseSpark";

export {
  createLuminousPointTracer,
  createGoldenSeedTracer,
  createCometSpark,
  createCrystalDrop,
  createFirefly,
  createMoonPearl,
  createVioletFlame,
  createOrbitingMote,
  createPrismShard,
  createRoseSpark,
};

export const TRACER_FACTORIES = {
  luminous_point: createLuminousPointTracer,
  golden_seed: createGoldenSeedTracer,
  comet_spark: createCometSpark,
  crystal_drop: createCrystalDrop,
  firefly: createFirefly,
  moon_pearl: createMoonPearl,
  violet_flame: createVioletFlame,
  orbiting_mote: createOrbitingMote,
  prism_shard: createPrismShard,
  rose_spark: createRoseSpark,
} as const;

export type TracerKind = keyof typeof TRACER_FACTORIES;

export function createTracer(kind: TracerKind, t0: number, position: { x: number; y: number }, options: { size: number }) {
  return TRACER_FACTORIES[kind](t0, position, options);
}