import React, { useMemo } from "react";
import type { CardAnimation } from "../types";

/**
 * Card-open animations are short, bounded DOM/CSS bursts — not Canvas.
 * They fire once per open and involve a handful of elements, so they don't
 * conflict with the "avoid thousands of DOM particles" rule that governs
 * the persistent Visual Engine. Each burst removes itself via CSS
 * animation-fill-mode; there is no JS timer to clean up.
 */

const PARTICLE_COUNT: Partial<Record<CardAnimation, number>> = {
  heart_burst: 10,
  sparkles: 14,
  petals: 10,
  butterflies: 4,
  fireflies: 8,
  stars: 12,
  confetti: 16,
};

const GLYPH: Partial<Record<CardAnimation, string>> = {
  heart_burst: "♥",
  sparkles: "✦",
  petals: "❀",
  butterflies: "❋",
  fireflies: "•",
  stars: "✶",
  confetti: "▪",
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** Renders the bounded particle burst for a given animation name, or nothing for "none"/unknown. */
export function CardAnimationOverlay({ animation }: { animation: CardAnimation }) {
  const count = PARTICLE_COUNT[animation];
  const glyph = GLYPH[animation];

  const particles = useMemo(() => {
    if (!count) return [];
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${randomBetween(10, 90)}%`,
      delay: `${randomBetween(0, 0.25)}s`,
      duration: `${randomBetween(0.9, 1.6)}s`,
      drift: `${randomBetween(-40, 40)}px`,
      scale: randomBetween(0.7, 1.3).toFixed(2),
    }));
    // Re-roll only when the animation itself changes (e.g. a new card opened).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation, count]);

  if (!count || !glyph) return null;

  return (
    <div className="card-animation-overlay" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className={`card-animation-particle card-animation-particle--${animation}`}
          style={
            {
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
              "--drift": p.drift,
              "--scale": p.scale,
            } as React.CSSProperties
          }
        >
          {glyph}
        </span>
      ))}
    </div>
  );
}
