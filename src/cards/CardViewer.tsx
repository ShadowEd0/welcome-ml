import React, { useEffect, useRef } from "react";
import { useCardsContext } from "./CardsContext";
import { FlipCard } from "./FlipCard";
import { CardAnimationOverlay } from "./animations";

const SWIPE_CLOSE_THRESHOLD_PX = 80;

export function CardViewer() {
  const { viewer, activeCard, closeViewer, showNext, showPrevious } = useCardsContext();
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // Close on Escape, navigate with arrow keys.
  useEffect(() => {
    if (!viewer.isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowRight") showNext();
      if (event.key === "ArrowLeft") showPrevious();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewer.isOpen, closeViewer, showNext, showPrevious]);

  // Move focus into the dialog when it opens, for keyboard/screen-reader users.
  useEffect(() => {
    if (viewer.isOpen) dialogRef.current?.focus();
  }, [viewer.isOpen]);

  if (!viewer.isOpen || !activeCard) return null;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) closeViewer();
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    touchStart.current = null;

    // Vertical swipe closes; horizontal swipe navigates.
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SWIPE_CLOSE_THRESHOLD_PX) {
      closeViewer();
      return;
    }
    if (Math.abs(dx) > SWIPE_CLOSE_THRESHOLD_PX) {
      if (dx < 0) showNext();
      else showPrevious();
    }
  };

  return (
    <div
      className="card-viewer-backdrop"
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={dialogRef}
        className="card-viewer-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${activeCard.character} card`}
        tabIndex={-1}
      >
        <button
          type="button"
          className="card-viewer-close"
          onClick={closeViewer}
          aria-label="Close card"
        >
          ×
        </button>

        <button
          type="button"
          className="card-viewer-nav card-viewer-nav--prev"
          onClick={showPrevious}
          aria-label="Previous card"
        >
          ‹
        </button>

        <div className="card-viewer-stage">
          <FlipCard key={activeCard.id} card={activeCard} imageLoading="eager" flippable className="flip-card--enlarged" />
          <CardAnimationOverlay animation={activeCard.animation} />
        </div>

        <button
          type="button"
          className="card-viewer-nav card-viewer-nav--next"
          onClick={showNext}
          aria-label="Next card"
        >
          ›
        </button>
      </div>
    </div>
  );
}
