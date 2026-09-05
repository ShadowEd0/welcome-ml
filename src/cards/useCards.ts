import { useEffect, useState } from "react";
import type { CardsState } from "./types";
import { validateCardCollection } from "./validateCard";

/**
 * URL du JSON des cartes.
 *
 * Relatif à la base (import.meta.env.BASE_URL, ici "./" grâce à vite.config.ts)
 * pour fonctionner aussi bien à la racine du domaine que dans un sous-chemin
 * (ex. GitHub Pages : https://user.github.io/repo/).
 *
 * En production, "data/" est copié vers "dist/data/" par le plugin
 * "copy-data-dir" (voir vite.config.ts) ; les chemins d'images de cards.json
 * ("../../data/cards_img/*") sont réécrits en relatifs à BASE_URL par
 * resolveCardImagePath() (voir validateCard.ts) et fonctionnent donc aussi
 * bien à la racine d'un domaine que dans un sous-chemin (GitHub Pages).
 */
const DEFAULT_CARDS_JSON_URL = `${import.meta.env.BASE_URL}data/cards.json`;

/**
 * Loads data/cards.json once, validates it, and exposes a stable state.
 * A fetch failure or malformed JSON degrades to an empty, non-crashing
 * card list rather than throwing.
 */
export function useCards(jsonUrl: string = DEFAULT_CARDS_JSON_URL): CardsState {
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
