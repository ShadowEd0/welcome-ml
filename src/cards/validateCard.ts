import { normalizeCardAnimation, type SanitizedCard } from "./types";

/**
 * Placeholder shown when a card is missing an image or its image fails to
 * load. Kept as an inline SVG data URI so it never depends on the network
 * or on a bundled asset that could itself go missing.
 */
export const FALLBACK_CARD_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200">
      <rect width="100%" height="100%" fill="#1b1330"/>
      <circle cx="400" cy="520" r="140" fill="#2c1f4a"/>
      <path d="M400 440 C 460 500, 460 560, 400 640 C 340 560, 340 500, 400 440 Z" fill="#5a3f8f"/>
      <text x="400" y="880" text-anchor="middle" font-family="serif" font-size="34" fill="#c9b6ff">
        image unavailable
      </text>
    </svg>`
  );

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Turns one raw JSON entry from data/cards.json into a card that is safe to
 * render. Never throws. Returns null only when the entry is missing the
 * fields that make it identifiable/renderable at all (id, image, character,
 * anime, quote) — such entries are skipped rather than shown broken.
 */
export function validateCard(raw: unknown, index: number): SanitizedCard | null {
  if (typeof raw !== "object" || raw === null) {
    console.warn(`[cards] entry at index ${index} is not an object — skipped.`);
    return null;
  }

  const candidate = raw as Record<string, unknown>;

  const id = isNonEmptyString(candidate.id) ? candidate.id : `card-${index}`;
  const character = isNonEmptyString(candidate.character) ? candidate.character : "";
  const anime = isNonEmptyString(candidate.anime) ? candidate.anime : "";
  const quote = isNonEmptyString(candidate.quote) ? candidate.quote : "";
  const image = isNonEmptyString(candidate.image) ? candidate.image : FALLBACK_CARD_IMAGE;

  if (!character || !anime || !quote) {
    console.warn(`[cards] entry "${id}" is missing required text fields — skipped.`);
    return null;
  }

  const author = isNonEmptyString(candidate.author) ? candidate.author : undefined;
  const animation = normalizeCardAnimation(candidate.animation);

  return { id, image, character, anime, quote, author, animation };
}

/** Validates a full raw JSON payload (expected to be an array). */
export function validateCardCollection(raw: unknown): SanitizedCard[] {
  if (!Array.isArray(raw)) {
    console.warn("[cards] data/cards.json did not parse to an array — showing no cards.");
    return [];
  }
  const seen = new Set<string>();
  const result: SanitizedCard[] = [];
  raw.forEach((entry, index) => {
    const card = validateCard(entry, index);
    if (!card) return;
    if (seen.has(card.id)) {
      console.warn(`[cards] duplicate card id "${card.id}" — keeping the first occurrence.`);
      return;
    }
    seen.add(card.id);
    result.push(card);
  });
  return result;
}
