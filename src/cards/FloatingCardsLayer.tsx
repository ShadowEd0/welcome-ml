import { useEffect, useMemo, useState } from "react";
import type { SanitizedCard } from "./types";
import { FloatingCard } from "./FloatingCard";
import { useCardsContext } from "./CardsContext";

const MAX_FLOATING_CARDS = 3;
const ROTATION_INTERVAL_MS = 25_000;

export interface FloatingCardsLayerProps {
  /** From UserPreferences.floatingCards — Customize panel controls this (Core/UI own the setting). */
  enabled: boolean;
  count: number;
  reducedMotion: boolean;
}

function pickSlots(pool: readonly SanitizedCard[], size: number, exclude: Set<string>) {
  const candidates = pool.filter((c) => !exclude.has(c.id));
  const source = candidates.length >= size ? candidates : pool;
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, size);
}

/** Displays a bounded set of floating, ambient FlipCards that open the enlarged viewer on click. */
export function FloatingCardsLayer({ enabled, count, reducedMotion }: FloatingCardsLayerProps) {
  const { cards, openCard } = useCardsContext();
  const visibleCount = Math.max(0, Math.min(MAX_FLOATING_CARDS, count));

  const [active, setActive] = useState<SanitizedCard[]>([]);

  useEffect(() => {
    if (!enabled || cards.length === 0) {
      setActive([]);
      return;
    }
    setActive(pickSlots(cards, visibleCount, new Set()));
  }, [enabled, cards, visibleCount]);

  useEffect(() => {
    if (!enabled || reducedMotion || cards.length <= visibleCount) return;
    const id = window.setInterval(() => {
      setActive((prev) => {
        const exclude = new Set(prev.map((c) => c.id));
        return pickSlots(cards, visibleCount, exclude);
      });
    }, ROTATION_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled, reducedMotion, cards, visibleCount]);

  const slots = useMemo(() => active.slice(0, visibleCount), [active, visibleCount]);

  if (!enabled || slots.length === 0) return null;

  return (
    <div className="floating-cards-layer" aria-label="Floating character cards">
      {slots.map((card, i) => (
        <FloatingCard
          key={card.id}
          card={card}
          slot={i}
          reducedMotion={reducedMotion}
          onOpen={() => openCard(card.id)}
        />
      ))}
    </div>
  );
}
