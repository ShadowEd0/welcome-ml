import type {
  VersoAnimationDefinition,
  VersoAnimationId,
  VersoScene,
} from "./types";

/**
 * Explicit, typed, dependency-free registry for verso animations.
 *
 * Adding an animation only requires:
 *   1. creating the scene (implements VersoScene);
 *   2. registering its definition once (registerVersoAnimation);
 *   3. referencing its id in a card's data ("verso": "<id>").
 *
 * No dynamic discovery and no hidden business logic: the registry is a
 * small, fully controlled map.
 */
const definitions = new Map<VersoAnimationId, VersoAnimationDefinition>();

export function registerVersoAnimation(definition: VersoAnimationDefinition): void {
  definitions.set(definition.id, definition);
}

/** Returns a brand-new scene instance, or null when the id is unknown. */
export function createVersoScene(id: VersoAnimationId | undefined): VersoScene | null {
  if (!id) return null;
  return definitions.get(id)?.create() ?? null;
}

/** All registered ids (e.g. for documentation or future debug surfaces). */
export function listVersoAnimationIds(): readonly VersoAnimationId[] {
  return [...definitions.keys()];
}