#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gestion des cartes du site via data/cards.json.

Usage:
    python add_card.py                -> menu interactif
    python add_card.py <n>            -> ajoute n cartes (raccourci)
    python add_card.py add <n>        -> ajoute n cartes depuis cards_img/unused
    python add_card.py complete       -> complète les champs manquants
    python add_card.py animate        -> réattribue aléatoirement une animation par carte

Aucun chemin absolu n'est requis : tous les chemins sont déduits de
l'emplacement de ce script, qui doit rester dans le dossier data/.
"""

import json
import random
import re
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent  # dossier data/
CARDS_FILE = DATA_DIR / "cards.json"
IMAGES_DIR = DATA_DIR / "cards_img"
UNUSED_DIR = IMAGES_DIR / "unused"

# Animations supportées par le site
# (voir src/core/contracts.ts -> KNOWN_CARD_ANIMATIONS).
ANIMATIONS = [
    "heart_burst",
    "sparkles",
    "petals",
    "butterflies",
    "fireflies",
    "stars",
    "glow",
    "confetti",
]

# Valeurs considérées comme "vides" -> proposées à la complétion.
EMPTY_VALUES = {"", " ", "none", "unknown"}
QUIT_WORDS = {"quit", "exit", "-q"}

CARD_ID_RE = re.compile(r"card-(\d+)")
CARD_IMAGE_RE = re.compile(r"card(\d+)\.(?:webp|png|jpe?g)")


def load_cards():
    """Charge data/cards.json. Sort avec un message clair si le fichier est illisible."""
    try:
        with open(CARDS_FILE, "r", encoding="utf-8") as f:
            cards = json.load(f)
    except FileNotFoundError:
        sys.exit(f"ERREUR : {CARDS_FILE} n'existe pas.")
    except json.JSONDecodeError as exc:
        sys.exit(f"ERREUR : {CARDS_FILE} n'est pas un JSON valide ({exc}).\n"
                 "Conflit Git non résolu (<<<<<<< / ======= / >>>>>>>) ? "
                 "Résolvez d'abord le conflit dans cards.json.")
    if not isinstance(cards, list):
        sys.exit(f"ERREUR : {CARDS_FILE} doit contenir un tableau JSON.")
    return cards


def save_cards(cards):
    with open(CARDS_FILE, "w", encoding="utf-8") as f:
        json.dump(cards, f, indent=4, ensure_ascii=False)
        f.write("\n")


def available_unused():
    if not UNUSED_DIR.is_dir():
        return []
    return sorted(p for p in UNUSED_DIR.iterdir() if p.is_file())


def next_numbers(cards):
    """Prochains numéros d'id (card-XXX) et de fichier image (cardN.webp) sans collision."""
    ids = [int(m.group(1)) for c in cards
           for m in [CARD_ID_RE.fullmatch(str(c.get("id", "")))] if m]
    imgs = {int(m.group(1)) for p in IMAGES_DIR.iterdir()
            for m in [CARD_IMAGE_RE.fullmatch(p.name)] if m}
    imgs |= {int(m.group(1)) for c in cards
             for m in [CARD_IMAGE_RE.search(str(c.get("image", "")))] if m}
    return (max(ids) + 1 if ids else 1), (max(imgs) + 1 if imgs else 1)


def add(count):
    """Ajoute `count` cartes en déplaçant des images depuis cards_img/unused."""
    available = available_unused()
    count = min(int(count), len(available))
    if count <= 0:
        print("Aucune image disponible dans cards_img/unused : rien à ajouter.")
        return

    cards = load_cards()
    next_id, next_image = next_numbers(cards)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    for source in random.sample(available, count):
        while (IMAGES_DIR / f"card{next_image}{source.suffix}").exists():
            next_image += 1
        destination = IMAGES_DIR / f"card{next_image}{source.suffix}"
        source.rename(destination)
        cards.append({
            "id": f"card-{next_id:03d}",
            "image": f"../../data/cards_img/{destination.name}",
            "character": "unknown",
            "anime": "unknown",
            "quote": "unknown",
            "animation": random.choice(ANIMATIONS),
            "author": "unknown",
        })
        next_id += 1
        next_image += 1

    save_cards(cards)
    print(f"{count} carte(s) ajoutée(s) et sauvegardée(s) dans {CARDS_FILE.name}.")


def complete():
    """Complète interactivement les champs vides / 'unknown' de chaque carte."""
    cards = load_cards()
    print("Instructions :")
    print(" - Complétez les champs vides ou 'unknown' des cartes ci-dessous.")
    print(" - 'quit', 'exit' ou '-q' pour quitter (les saisies déjà faites sont gardées).")
    print(" - Entrée vide, 'none' ou 'unknown' remet le champ à 'unknown'.\n")

    stop = False
    for card in cards:
        if stop:
            break
        empty_fields = [f for f in card if str(card[f]).strip().lower() in EMPTY_VALUES]
        if not empty_fields:
            continue
        print(f"=================== carte id: {card.get('id')} ===================\n")
        for field in empty_fields:
            value = input(f"    {field}: ")
            if value.strip().lower() in QUIT_WORDS:
                stop = True
                break
            if value.strip().lower() in EMPTY_VALUES:
                card[field] = "unknown"
            else:
                card[field] = value.strip()
        print()

    save_cards(cards)
    print("Complétion interrompue — saisies déjà effectuées sauvegardées." if stop
          else "Complétion terminée.")


def animate():
    """Réattribue aléatoirement une animation à chaque carte."""
    cards = load_cards()
    for card in cards:
        card["animation"] = random.choice(ANIMATIONS)
    save_cards(cards)
    print(f"Animation réattribuée à {len(cards)} carte(s).")


def show_menu():
    print("Menu add_card.py :")
    print("  1 · add N       ajouter N cartes")
    print("  2 · complete    compléter les champs manquants")
    print("  3 · animate     réattribuer les animations")
    choice = input("\nChoix [défaut 2 · complete] : ").strip().lower()
    if choice in {"add", "1"}:
        value = input("Combien de cartes ajouter ? [défaut 1] : ").strip()
        add(int(value) if value.isdigit() else 1)
    elif choice in {"animate", "3"}:
        animate()
    else:
        complete()


def main(args):
    if not args:
        show_menu()
        return
    first = args[0].strip().lower()
    if first.isdigit():
        add(int(first))
    elif first == "add":
        add(int(args[1]) if len(args) > 1 and args[1].isdigit() else 1)
    elif first == "complete":
        complete()
    elif first == "animate":
        animate()
    else:
        print(f"Commande inconnue : {first}\n")
        show_menu()


if __name__ == "__main__":
    main(sys.argv[1:])