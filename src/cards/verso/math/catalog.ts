/**
 * Math Verso Engine — curated catalogue of finished mathematical versos.
 *
 * This is the SOURCE OF TRUTH for the "good" versos that are part of the
 * WELCOME ML catalogue. It is deliberately separate from the technical
 * `registry.ts` (which maps every registered id, including demos) and from
 * the per-mission scenes in `roseGarden` / `m24CompositionDemo`.
 *
 * A verso is a complete scene: universe + reference frame + one or more
 * CurveLayers (function + transform + style + tracer + trail) + animation.
 *
 * To add a nuevo verso to the catalogue:
 *   1. author the scene as a `create()` returning a `MathScene`;
 *   2. add one entry here (id, name, family, description, create);
 *   3. the random/balancing system and manual picker in add_card.py use the
 *      ids from this catalogue (kept mirrored there, documented).
 *
 * The catalogue stays extensible: no engine change is ever needed to add
 * a scene.
 */

import type { VersoAnimationDefinition, VersoScene } from "../types";
import type { MathScene } from "./scene";
import { createRoseGardenScene } from "./scenes/roseGarden";
import { petalMandala } from "./scenes/catalog/petalMandala";
import { cloverMeadow } from "./scenes/catalog/cloverMeadow";
import { celestialOrbits } from "./scenes/catalog/celestialOrbits";
import { goldenSpiral } from "./scenes/catalog/goldenSpiral";
import { cardioidEcho } from "./scenes/catalog/cardioidEcho";
import { lemniscateInfinity } from "./scenes/catalog/lemniscateInfinity";
import { lissajousWeave } from "./scenes/catalog/lissajousWeave";
import { spirokinetic } from "./scenes/catalog/spirokinetic";
import { dampedMemory } from "./scenes/catalog/dampedMemory";
import { celestialButterfly } from "./scenes/catalog/celestialButterfly";
import { roseGalaxy } from "./scenes/catalog/roseGalaxy";
import { orbitalSymphony } from "./scenes/catalog/orbitalSymphony";
import { quantumLace } from "./scenes/catalog/quantumLace";
import { crystalMaurer } from "./scenes/catalog/crystalMaurer";
import { attractorSilk } from "./scenes/catalog/attractorSilk";
import { cymaticResonance } from "./scenes/catalog/cymaticResonance";
import { pulsarWaves } from "./scenes/catalog/pulsarWaves";
import { fermatVortex } from "./scenes/catalog/fermatVortex";
import { logPulsing } from "./scenes/catalog/logPulsing";
import { gielisShield } from "./scenes/catalog/gielisShield";
import { thomasKnot } from "./scenes/catalog/thomasKnot";
import { gaborRipple } from "./scenes/catalog/gaborRipple";
import { torusRibbon } from "./scenes/catalog/torusRibbon";
import { cornuNebula } from "./scenes/catalog/cornuNebula";
import { aizawaVortex } from "./scenes/catalog/aizawaVortex";
import { rationalLens } from "./scenes/catalog/rationalLens";
import { shockwaveCrystal } from "./scenes/catalog/shockwaveCrystal";

export type MathVersoFamily =
  | "floral"
  | "orbital"
  | "geometric"
  | "parametric"
  | "poetic"
  | "spectacular";

export interface MathVersoEntry {
  /** Technical id referenced by cards.json / add_card.py (unique, stable). */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Visual family (for grouping in the catalogue UI / documentation). */
  readonly family: MathVersoFamily;
  /** Short description of the visual idea. */
  readonly description: string;
  /** Build a brand-new scene instance. */
  readonly create: () => MathScene;
}

/** Build a VersoAnimationDefinition from a catalogue entry. */
export function toDefinition(entry: MathVersoEntry): VersoAnimationDefinition {
  return { id: entry.id, create: entry.create };
}

/**
 * All finished catalogue versos. Order matters only for display; the
 * balancing system never relies on order (it derives counts from cards.json).
 */
export const MATH_VERSO_CATALOGUE: readonly MathVersoEntry[] = [
  {
    id: "rose_garden",
    name: "Jardin de roses",
    family: "floral",
    description: "Rose k=5 dorée sur indigo, tracer et trail (scène fondatrice).",
    create: createRoseGardenScene,
  },
  petalMandala,
  cloverMeadow,
  celestialOrbits,
  goldenSpiral,
  cardioidEcho,
  lemniscateInfinity,
  lissajousWeave,
  spirokinetic,
  dampedMemory,
  celestialButterfly,
  roseGalaxy,
  orbitalSymphony,
  quantumLace,
  crystalMaurer,
  attractorSilk,
  cymaticResonance,
  pulsarWaves,
  fermatVortex,
  logPulsing,
  gielisShield,
  thomasKnot,
  gaborRipple,
  torusRibbon,
  cornuNebula,
  aizawaVortex,
  rationalLens,
  shockwaveCrystal,
];

/** All catalogue ids, in catalogue order. */
export function listCatalogueVersoIds(): readonly string[] {
  return MATH_VERSO_CATALOGUE.map((e) => e.id);
}

/** Look up a catalogue entry by id (undefined when unknown). */
export function getCatalogueVerso(id: string): MathVersoEntry | undefined {
  return MATH_VERSO_CATALOGUE.find((e) => e.id === id);
}

/** Names for documentation / optional display. */
export function catalogueName(id: string): string {
  return getCatalogueVerso(id)?.name ?? id;
}

export type { VersoScene };
