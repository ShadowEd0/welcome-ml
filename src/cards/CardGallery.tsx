import React from "react";
import { useCardsContext } from "./CardsContext";
import { FlipCard } from "./FlipCard";

/** Full scrollable grid of every card — reached from the "Cards" menu space. */
export function CardGallery() {
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
        <FlipCard key={card.id} card={card} onOpen={() => openCard(card.id)} />
      ))}
    </div>
  );
}
