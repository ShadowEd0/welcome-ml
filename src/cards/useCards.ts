import { useEffect, useState } from "react";
import type { CardsState } from "./types";
import { validateCardCollection } from "./validateCard";

/**
 * Loads data/cards.json once, validates it, and exposes a stable state.
 * A fetch failure or malformed JSON degrades to an empty, non-crashing
 * card list rather than throwing.
 */
export function useCards(jsonUrl: string = "/data/cards.json"): CardsState {
  const [state, setState] = useState<CardsState>({ status: "idle", cards: [] });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", cards: [] });

    fetch(jsonUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${jsonUrl}: ${res.status}`);
        return res.json();
      })
      .then((raw) => {
        if (cancelled) return;
        const cards = validateCardCollection(raw);
        setState({ status: "ready", cards });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error loading cards.";
        console.error("[cards]", message);
        setState({ status: "error", cards: [], error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [jsonUrl]);

  return state;
}
