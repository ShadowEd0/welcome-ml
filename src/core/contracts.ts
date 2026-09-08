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

/**
 * Configuration of a card as an autonomous visual unit.
 *
 * A card no longer references any external work or attribution. Its identity
 * comes from `id`, its visual from `image`, its open burst from `animation`
 * and its back-face universe from `verso`. Future verso experiences (the
 * "100 mini-univers") will extend the back-face configuration without
 * reworking this card model.
 */
export interface CardConfig {
  /** Unique identity of the card. */
  id: Identifier;
  /** Primary visual resource (project-relative path, absolute URL, or data URI). */
  image: string;
  /** Burst animation played on open (see CardAnimationOverlay). */
  animation?: CardAnimation | (string & {});
  /** If true, animation is chosen randomly from RANDOMIZABLE_ANIMATIONS at load time. */
  randomAnimation?: boolean;
  /**
   * Back-face animation id, resolved by the verso system
   * (VersoAnimationRenderer). Unknown or absent → static decorative back.
   *
   * When present it always wins over `versoPool`: a card configured with
   * both keeps its unique animation.
   */
  verso?: string;
  /**
   * Optional pool of back-face animation ids. When `verso` is absent, the
   * renderer draws one id from this pool for each opening of the card (the
   * choice is made at runtime, the JSON only describes the possibilities).
   * Unknown ids are skipped by the renderer.
   */
  versoPool?: string[];
  /**
   * Optional text message to display on the card's verso.
   * When present, enables text-based verso animations.
   */
  message?: string;
  /**
   * Optional text animation id for the verso message.
   * Works alongside `verso`/`versoPool` — a card can have both a graphical
   * verso and a text message with its own animation.
   */
  messageAnimation?: string;
}

