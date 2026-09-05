import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Identifier } from "../core";
import type { CardsState, SanitizedCard, ViewerState } from "./types";
import { useCards } from "./useCards";

interface CardsContextValue extends CardsState {
  viewer: ViewerState;
  openCard: (id: Identifier) => void;
  closeViewer: () => void;
  showNext: () => void;
  showPrevious: () => void;
  activeCard: SanitizedCard | null;
}

const CardsContext = createContext<CardsContextValue | null>(null);

export function CardsProvider({
  children,
  jsonUrl,
}: {
  children: React.ReactNode;
  jsonUrl?: string;
}) {
  const cardsState = useCards(jsonUrl);
  const [viewer, setViewer] = useState<ViewerState>({ isOpen: false, activeCardId: null });

  const openCard = useCallback((id: Identifier) => {
    setViewer({ isOpen: true, activeCardId: id });
  }, []);

  const closeViewer = useCallback(() => {
    setViewer({ isOpen: false, activeCardId: null });
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      setViewer((prev) => {
        if (!prev.activeCardId || cardsState.cards.length === 0) return prev;
        const currentIndex = cardsState.cards.findIndex((c) => c.id === prev.activeCardId);
        if (currentIndex === -1) return prev;
        const nextIndex =
          (currentIndex + direction + cardsState.cards.length) % cardsState.cards.length;
        return { isOpen: true, activeCardId: cardsState.cards[nextIndex].id };
      });
    },
    [cardsState.cards]
  );

  const showNext = useCallback(() => step(1), [step]);
  const showPrevious = useCallback(() => step(-1), [step]);

  const activeCard = useMemo(
    () => cardsState.cards.find((c) => c.id === viewer.activeCardId) ?? null,
    [cardsState.cards, viewer.activeCardId]
  );

  const value = useMemo<CardsContextValue>(
    () => ({
      ...cardsState,
      viewer,
      openCard,
      closeViewer,
      showNext,
      showPrevious,
      activeCard,
    }),
    [cardsState, viewer, openCard, closeViewer, showNext, showPrevious, activeCard]
  );

  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

export function useCardsContext(): CardsContextValue {
  const ctx = useContext(CardsContext);
  if (!ctx) {
    throw new Error("useCardsContext must be used within a <CardsProvider>.");
  }
  return ctx;
}
