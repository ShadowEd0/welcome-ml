import { useCardsContext } from "./CardsContext";
import { FlipCard } from "./FlipCard";
import type { Identifier } from "./types";

interface CardGalleryProps {
  /** Fired when a card is opened (e.g. so an enclosing modal can close). */
  onOpenCard?: (id: Identifier) => void;
}

/** Full scrollable grid of every card — reached from the "Cards" menu space. */
export function CardGallery({ onOpenCard }: CardGalleryProps) {
  const { status, cards, error, openCard } = useCardsContext();

  if (status === "loading" || status === "idle") {
    return (
      <div className="card-gallery card-gallery--message" role="status">
        Gathering cards…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="card-gallery card-gallery--message" role="alert">
        Couldn't load the card collection{error ? `: ${error}` : "."}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="card-gallery card-gallery--message" role="status">
        No cards yet.
      </div>
    );
  }

  return (
    <div className="card-gallery">
      {cards.map((card) => (
        <FlipCard
          key={card.id}
          card={card}
          onOpen={() => {
            onOpenCard?.(card.id);
            openCard(card.id);
          }}
        />
      ))}
    </div>
  );
}
