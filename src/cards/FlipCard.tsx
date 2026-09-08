import React, { useState } from "react";
import type { SanitizedCard } from "./types";
import { ImageWithFallback } from "./ImageWithFallback";
import { VersoAnimationRenderer } from "./verso";

/**
 * Resolves the single verso animation for one opening of a card:
 * a unique `verso` wins over any pool; otherwise one id is drawn from
 * `versoPool` at mount time (stateless — nothing persists between mounts).
 * If a text message is present, its `messageAnimation` takes precedence
 * for the verso (text animation replaces graphical verso).
 * The caller keeps the result stable for the whole mount, so the back face
 * shows one scene per opening while the JSON only describes possibilities.
 */
function resolveVerso(card: SanitizedCard): string | undefined {
  // Text message with animation takes precedence over graphical verso
  if (card.message && card.messageAnimation && card.messageAnimation.trim().length > 0) {
    return card.messageAnimation;
  }
  if (card.verso && card.verso.trim().length > 0) return card.verso;
  const pool = card.versoPool;
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return undefined;
}

interface FlipCardProps {
  card: SanitizedCard;
  /** "eager" when this card is the one in the enlarged viewer. */
  imageLoading?: "lazy" | "eager";
  /** Clicking the card body (not the flip) — used by floating cards to open the viewer. */
  onOpen?: () => void;
  /** If true, clicking toggles the flip instead of calling onOpen. Used inside the enlarged viewer. */
  flippable?: boolean;
  className?: string;
}

export function FlipCard({
  card,
  imageLoading = "lazy",
  onOpen,
  flippable = false,
  className,
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [resolvedVerso] = useState(() => resolveVerso(card));

  const handleClick = () => {
    if (flippable) {
      setIsFlipped((f) => !f);
    } else if (onOpen) {
      onOpen();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div
      className={["flip-card", isFlipped ? "flip-card--flipped" : "", className]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      aria-label={`Card ${card.id}${flippable ? ", press to flip" : ", press to open"}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flip-card__inner">
        <div className="flip-card__face flip-card__face--front">
          <ImageWithFallback
            className="flip-card__image"
            src={card.image}
            alt={`Card visual (${card.id})`}
            loading={imageLoading}
          />
        </div>

        <div className="flip-card__face flip-card__face--back" aria-hidden="true">
          {flippable && <VersoAnimationRenderer animationId={resolvedVerso} active={isFlipped} message={card.message} />}
        </div>
      </div>
    </div>
  );
}
