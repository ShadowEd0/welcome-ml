import React, { useState } from "react";
import type { SanitizedCard } from "./types";
import { ImageWithFallback } from "./ImageWithFallback";

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
      aria-label={`${card.character} — ${card.anime}${flippable ? ", press to flip" : ", press to open"}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flip-card__inner">
        <div className="flip-card__face flip-card__face--front">
          <span className="flip-card__character">{card.character}</span>
          <ImageWithFallback
            className="flip-card__image"
            src={card.image}
            alt={`${card.character} from ${card.anime}`}
            loading={imageLoading}
          />
          <span className="flip-card__anime">{card.anime}</span>
        </div>

        <div className="flip-card__face flip-card__face--back">
          <p className="flip-card__quote">{card.quote}</p>
          {card.author && <span className="flip-card__author">{card.author}</span>}
        </div>
      </div>
    </div>
  );
}
