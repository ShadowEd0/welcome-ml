import React, { useEffect, useRef, useState } from "react";
import type { SanitizedCard } from "./types";
import { FlipCard } from "./FlipCard";

interface FloatingCardProps {
  card: SanitizedCard;
  /** Deterministic per-slot variation so the three floating cards don't move in lockstep. */
  slot: number;
  onOpen: () => void;
  reducedMotion: boolean;
}

/**
 * Positions and animates one floating card. Motion is expressed entirely in
 * CSS custom properties + a CSS animation, so there is no per-frame JS work
 * for idle floating — only the (optional, lightweight) pointer-parallax
 * listener runs in JS.
 */
export function FloatingCard({ card, slot, onOpen, reducedMotion }: FloatingCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion) return;
    const handlePointerMove = (event: PointerEvent) => {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      // Different depth per slot so cards drift at slightly different rates.
      const depth = 6 + slot * 4;
      setParallax({ x: nx * depth, y: ny * depth });
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [reducedMotion, slot]);

  const floatDuration = 7 + slot * 1.5; // seconds; staggered so slots don't sync
  const floatDelay = slot * -2.3;

  return (
    <div
      ref={ref}
      className={`floating-card floating-card--slot-${slot}`}
      style={
        {
          "--float-duration": reducedMotion ? "0s" : `${floatDuration}s`,
          "--float-delay": `${floatDelay}s`,
          "--parallax-x": `${parallax.x}px`,
          "--parallax-y": `${parallax.y}px`,
        } as React.CSSProperties
      }
    >
      <FlipCard card={card} onOpen={onOpen} imageLoading="lazy" />
    </div>
  );
}
