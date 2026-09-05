import React, { useEffect, useRef } from "react";
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
 *
 * Parallax updates bypass React's state entirely: they are written directly
 * to the DOM via a coalesced requestAnimationFrame, eliminating re-renders
 * during pointer movement while preserving identical visual behavior.
 */
export function FloatingCard({ card, slot, onOpen, reducedMotion }: FloatingCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const parallax = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;

    const applyParallax = () => {
      const el = ref.current;
      if (el) {
        el.style.setProperty("--parallax-x", `${parallax.current.x}px`);
        el.style.setProperty("--parallax-y", `${parallax.current.y}px`);
      }
      rafId.current = null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      // Different depth per slot so cards drift at slightly different rates.
      const depth = 6 + slot * 4;
      parallax.current = { x: nx * depth, y: ny * depth };
      // Coalesce updates to one DOM write per frame, skipping React entirely.
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(applyParallax);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      // Cancel any pending RAF on unmount to avoid writing to an unmounted DOM node.
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
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
        } as React.CSSProperties
      }
    >
      <FlipCard card={card} onOpen={onOpen} imageLoading="lazy" />
    </div>
  );
}
