/**
 * Math Verso Engine — universe registry.
 *
 * Exposes the 10 atmospheric backdrops and a small factory so scenes can
 * select an universe by id without importing each class individually.
 */

import type { Universe } from "../types";
import { MidnightObservatoryUniverse } from "./midnightObservatory";
import { VioletDreamUniverse } from "./violetDream";
import { DeepOceanUniverse } from "./deepOcean";
import { EmeraldGardenUniverse } from "./emeraldGarden";
import { MoonlitPaperUniverse } from "./moonlitPaper";
import { CosmicPlumUniverse } from "./cosmicPlum";
import { GoldenHourUniverse } from "./goldenHour";
import { ArcticSilenceUniverse } from "./arcticSilence";
import { RoseCosmosUniverse } from "./roseCosmos";
import { BlackMirrorUniverse } from "./blackMirror";
import { EmberVoidUniverse } from "./emberVoid";
import { SilkSmokeUniverse } from "./silkSmoke";
import { VoidIceUniverse } from "./voidIce";
import { CalmAquaUniverse } from "./calmAqua";

export type UniverseId =
  | "midnight_observatory"
  | "violet_dream"
  | "deep_ocean"
  | "emerald_garden"
  | "moonlit_paper"
  | "cosmic_plum"
  | "golden_hour"
  | "arctic_silence"
  | "rose_cosmos"
  | "black_mirror"
  | "ember_void"
  | "silk_smoke"
  | "void_ice"
  | "calm_aqua";

const factories: Record<UniverseId, () => Universe> = {
  midnight_observatory: () => new MidnightObservatoryUniverse(),
  violet_dream: () => new VioletDreamUniverse(),
  deep_ocean: () => new DeepOceanUniverse(),
  emerald_garden: () => new EmeraldGardenUniverse(),
  moonlit_paper: () => new MoonlitPaperUniverse(),
  cosmic_plum: () => new CosmicPlumUniverse(),
  golden_hour: () => new GoldenHourUniverse(),
  arctic_silence: () => new ArcticSilenceUniverse(),
  rose_cosmos: () => new RoseCosmosUniverse(),
  black_mirror: () => new BlackMirrorUniverse(),
  ember_void: () => new EmberVoidUniverse(),
  silk_smoke: () => new SilkSmokeUniverse(),
  void_ice: () => new VoidIceUniverse(),
  calm_aqua: () => new CalmAquaUniverse(),
};

/** All available universe ids. */
export const UNIVERSE_IDS: readonly UniverseId[] = Object.keys(factories) as UniverseId[];

/** Create an universe by id. Returns null for unknown ids. */
export function createUniverse(id: string | undefined): Universe | null {
  if (!id) return null;
  const factory = factories[id as UniverseId];
  return factory ? factory() : null;
}

// Re-exports for direct imports
export { MidnightObservatoryUniverse } from "./midnightObservatory";
export { VioletDreamUniverse } from "./violetDream";
export { DeepOceanUniverse } from "./deepOcean";
export { EmeraldGardenUniverse } from "./emeraldGarden";
export { MoonlitPaperUniverse } from "./moonlitPaper";
export { CosmicPlumUniverse } from "./cosmicPlum";
export { GoldenHourUniverse } from "./goldenHour";
export { ArcticSilenceUniverse } from "./arcticSilence";
export { RoseCosmosUniverse } from "./roseCosmos";
export { BlackMirrorUniverse } from "./blackMirror";
export { EmberVoidUniverse } from "./emberVoid";
export { SilkSmokeUniverse } from "./silkSmoke";
export { VoidIceUniverse } from "./voidIce";
export { CalmAquaUniverse } from "./calmAqua";

// Factory functions — convenient shorthand for `new XxxUniverse()`.
export const createMidnightObservatory = () => new MidnightObservatoryUniverse();
export const createVioletDream = () => new VioletDreamUniverse();
export const createDeepOcean = () => new DeepOceanUniverse();
export const createEmeraldGarden = () => new EmeraldGardenUniverse();
export const createMoonlitPaper = () => new MoonlitPaperUniverse();
export const createCosmicPlum = () => new CosmicPlumUniverse();
export const createGoldenHour = () => new GoldenHourUniverse();
export const createArcticSilence = () => new ArcticSilenceUniverse();
export const createRoseCosmos = () => new RoseCosmosUniverse();
export const createBlackMirror = () => new BlackMirrorUniverse();
export const createEmberVoid = () => new EmberVoidUniverse();
export const createSilkSmoke = () => new SilkSmokeUniverse();
export const createVoidIce = () => new VoidIceUniverse();
export const createCalmAqua = () => new CalmAquaUniverse();
