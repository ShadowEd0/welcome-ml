/**
 * Cards module — local types.
 *
 * The canonical `CardConfig` / `CardAnimation` / `KNOWN_CARD_ANIMATIONS` /
 * `normalizeCardAnimation` contracts live in Core (`contracts.ts`) and are
 * re-exported here so the rest of this module has a single import surface.
 *
 * Adjust the import path below if Core is published under a different
 * package name/alias in the final workspace (e.g. "@welcome-ml/core").
 */
import type { CardAnimation, CardConfig, Identifier } from "../core";
import { KNOWN_CARD_ANIMATIONS, RANDOMIZABLE_ANIMATIONS, normalizeCardAnimation } from "../core";

export type { CardAnimation, CardConfig, Identifier };
export { KNOWN_CARD_ANIMATIONS, RANDOMIZABLE_ANIMATIONS, normalizeCardAnimation };

/** A card after JSON has been validated/sanitized — safe to render. */
export interface SanitizedCard extends CardConfig {
  animation: CardAnimation;
}

export type CardsLoadStatus = "idle" | "loading" | "ready" | "error";

export interface CardsState {
  status: CardsLoadStatus;
  cards: readonly SanitizedCard[];
  error?: string;
}

export interface ViewerState {
  isOpen: boolean;
  activeCardId: Identifier | null;
}
