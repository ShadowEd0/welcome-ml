/**
 * Shared, framework-agnostic contracts for the WELCOME ML experience.
 *
 * Single source of truth for contracts shared across modules (cards,
 * settings, visual-engine). It intentionally contains only contracts that
 * are actually consumed — module-specific types (universes, effects
 * rendering) live in their own module (src/universes, src/visual-engine).
 */

export type Identifier = string;

/**
 * Canonical quality level, shared by the settings UI, user preferences and
 * the visual engine (which re-exports it) — do not redefine it elsewhere.
 */
export type QualityLevel = "AUTO" | "LOW" | "MEDIUM" | "HIGH" | "ULTRA";

export type CardAnimation =
  | "heart_burst"
  | "sparkles"
  | "petals"
  | "butterflies"
  | "fireflies"
  | "stars"
  | "glow"
  | "confetti"
  | "none";

/**
 * Animations eligible for random selection.
 * Intentionally excludes "none" — a random pick should always produce a visible effect.
 */
export const RANDOMIZABLE_ANIMATIONS: readonly CardAnimation[] = [
  "heart_burst",
  "sparkles",
  "petals",
  "butterflies",
  "fireflies",
  "stars",
  "glow",
  "confetti",
];

export const KNOWN_CARD_ANIMATIONS: readonly CardAnimation[] = [
  "heart_burst",
  "sparkles",
  "petals",
  "butterflies",
  "fireflies",
  "stars",
  "glow",
  "confetti",
  "none",
];

/** Maps untrusted card JSON to the guaranteed no-op animation when unknown. */
export function normalizeCardAnimation(value: unknown): CardAnimation {
  return typeof value === "string" && KNOWN_CARD_ANIMATIONS.includes(value as CardAnimation)
    ? value as CardAnimation
    : "none";
}

export interface CardConfig {
  id: Identifier;
  image: string;
  character: string;
  anime: string;
  quote: string;
  author?: string;
  animation?: CardAnimation | (string & {});
  /** If true, animation is chosen randomly from RANDOMIZABLE_ANIMATIONS at load time. */
  randomAnimation?: boolean;
}

