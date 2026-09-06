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
    python add_card.py migrate        -> reconvertit les images des cartes existantes
                                         en vrais WebP normalisés (3:4, <= 1200 px)

Pipeline d'import des images :
    image brute -> data/cards_img/unused/ -> add_card.py add N ->
    analyse du format réel (Pillow) -> normalisation (mode couleur, taille) ->
    crop éventuel vers le ratio 3:4 (sans déformation) ->
    encodage WebP (qualité 82) -> data/cards_img/cardN.webp -> carte ajoutée à cards.json.
    L'image source n'est jamais déplacée ni supprimée : elle reste dans unused/.

Outil requis : Pillow (Python). Aucune autre dépendance.

Installation de la dépendance :
    python -m pip install -r data/requirements.txt

Aucun chemin absolu n'est requis : tous les chemins sont déduits de
l'emplacement de ce script, qui doit rester dans le dossier data/.
"""

import json
import random
import re
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
    from PIL import UnidentifiedImageError
    PILLOW_AVAILABLE = True
except ImportError:
    PILLOW_AVAILABLE = False
    Image = None
    UnidentifiedImageError = OSError

DATA_DIR = Path(__file__).resolve().parent  # dossier data/
CARDS_FILE = DATA_DIR / "cards.json"
IMAGES_DIR = DATA_DIR / "cards_img"
UNUSED_DIR = IMAGES_DIR / "unused"

# ---------------------------------------------------------------------------
# Pipeline de normalisation des images (AUDIT #7 BIS).
# Le format officiel des cartes est désormais un VRAI WebP, produit par ce
# script. Les images déposées dans unused/ peuvent être de n'importe quel
# format réel (jpg, png, webp…) ; la détection et la conversion sont faites
# ici par Pillow, jamais par l'extension de fichier.
# L'original n'est jamais supprimé ni déplacé : unused/ reste la bibliothèque
# de sources réutilisables.
# ---------------------------------------------------------------------------

# Ratio cible d'une carte (largeur / hauteur), ici 3:4.
TARGET_RATIO = 3 / 4
# Écart relatif tolérable autour du ratio cible : pas de crop si déjà proche.
TOLERANCE = 0.08
# Grand côté maximal (px) après redimensionnement (jamais d'agrandissement).
MAX_EDGE = 1200
# Qualité d'encodage WebP.
WEBP_QUALITY = 82

# Listes d'ancres proposées selon l'axe du crop (vertical pour les images
# trop hautes, horizontal pour les images trop larges).
CROP_ANCHORS = {
    "center": "center",
    "top": "top",
    "bottom": "bottom",
    "left": "left",
    "right": "right",
}

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
    """Fichiers de unused/ réutilisables comme sources de nouvelles cartes.
    Les sauvegardes «original-cardN.*» créées par `migrate` sont exclues."""
    if not UNUSED_DIR.is_dir():
        return []
    return sorted(p for p in UNUSED_DIR.iterdir()
                  if p.is_file() and not p.name.startswith("original-"))


def next_numbers(cards):
    """Prochains numéros d'id (card-XXX) et de fichier image (cardN.webp) sans collision."""
    ids = [int(m.group(1)) for c in cards
           for m in [CARD_ID_RE.fullmatch(str(c.get("id", "")))] if m]
    imgs = {int(m.group(1)) for p in IMAGES_DIR.iterdir()
            for m in [CARD_IMAGE_RE.fullmatch(p.name)] if m}
    imgs |= {int(m.group(1)) for c in cards
             for m in [CARD_IMAGE_RE.search(str(c.get("image", "")))] if m}
    return (max(ids) + 1 if ids else 1), (max(imgs) + 1 if imgs else 1)


def load_image_file(path):
    """Ouvre une image par son contenu réel (Pillow), pas par son extension.
    Retourne (image, format_réel) ou (None, None) si le fichier est illisible.
    L'original n'est jamais modifié."""
    if not PILLOW_AVAILABLE:
        print(f"ERREUR : Pillow n'est pas installé — impossible de traiter {path.name}.")
        return None, None
    try:
        im = Image.open(path)
        im.load()  # force la lecture complète : détecte les fichiers tronqués
    except (UnidentifiedImageError, OSError) as exc:
        print(f"ERREUR : impossible de lire {path.name} ({exc}). "
              f"Aucune carte créée, original conservé.")
        return None, None
    return im, im.format


def ensure_color_mode(im):
    """Normalise le mode de couleur avant l'encodage WebP.

    WebP gère l'alpha : une image RGBA (ou à transparence) est encodée en
    RGBA afin de ne pas détruire inutilement une transparence pertinente.
    Tous les autres modes sont aplatis en RGB (l'encodage WebP final ne
    prend que RGB / RGBA).
    """
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        return im.convert("RGBA")
    return im.convert("RGB")


def downscale(im):
    """Réduit le grand côté à MAX_EDGE en conservant le ratio source.
    N'agrandit jamais une image déjà plus petite que MAX_EDGE."""
    w, h = im.size
    longest = max(w, h)
    if longest <= MAX_EDGE:
        return im
    scale = MAX_EDGE / longest
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                     Image.Resampling.LANCZOS)


def crop_box(w, h, anchor):
    """Boîte de recadrage pour le ratio cible, SANS déformer l'image.

    - image plus large que le ratio cible -> rognage horizontal (left/right/center) ;
    - image plus haute que le ratio cible -> rognage vertical (top/bottom/center).

    Retourne (left, top, right, bottom) et True si le rognage est vertical.
    """
    taller = (w / h) <= TARGET_RATIO
    if taller:
        box_w, box_h = w, min(h, round(w / TARGET_RATIO))
        x0, x1 = 0, box_w
        if anchor == "top":
            y0 = 0
        elif anchor == "bottom":
            y0 = h - box_h
        else:
            y0 = (h - box_h) // 2
        y1 = y0 + box_h
    else:
        box_w, box_h = min(w, round(h * TARGET_RATIO)), h
        y0, y1 = 0, box_h
        if anchor == "left":
            x0 = 0
        elif anchor == "right":
            x0 = w - box_w
        else:
            x0 = (w - box_w) // 2
        x1 = x0 + box_w
    return (x0, y0, x1, y1), taller


def confirm_crop(src_w, src_h, box_w, box_h, taller):
    """Informe le créateur sur le crop nécessaire et le laisse choisir l'ancre.
    Retourne l'ancre choisie, ou None si le crop est annulé (cancel)."""
    print("\nImage source :")
    print(f"  {src_w} x {src_h} px   —   ratio {src_w / src_h:.3f}")
    print("\nCrop cible (3:4, sans déformation) :")
    print(f"  {box_w} x {box_h} px   —   ratio {box_w / box_h:.3f}")
    kept = box_w * box_h / (src_w * src_h) * 100
    print(f"\n  Zone conservée : {kept:.0f} % de l'image source.\n")

    if taller:
        options = [("1", "center"), ("2", "top"), ("3", "bottom"), ("4", "cancel")]
    else:
        options = [("1", "center"), ("2", "left"), ("3", "right"), ("4", "cancel")]
    for num, name in options:
        print(f"  {num}. {name if name == 'cancel' else CROP_ANCHORS[name]}")
    choice = input(f"\nCadrage [défaut 1 · {CROP_ANCHORS['center']}] : ").strip().lower()
    if choice in {"4", "cancel"} or choice in QUIT_WORDS:
        return None
    return dict(options).get(choice, "center")


def prepare_image(source):
    """Analyse et normalise une image source (sans rien écrire sur le disque).

    Retourne (image_pillow, infos) ou (None, None) si le fichier est illisible
    ou si le crop est annulé par le créateur. L'original n'est jamais touché.
    """
    im, real_fmt = load_image_file(source)
    if im is None:
        return None, None

    if real_fmt and source.suffix.lower() != f".{real_fmt.lower()}":
        print(f"Remarque : {source.name} a l'extension «{source.suffix}» "
              f"mais contient réellement un {real_fmt} — lu correctement quand même.")
    print(f"Image source : {source.name}  ({real_fmt}, {im.size[0]} x {im.size[1]} px)")

    im = ensure_color_mode(im)
    im = downscale(im)
    w, h = im.size
    ratio = w / h
    anchored = "center"
    cropped = False

    if abs(ratio - TARGET_RATIO) / TARGET_RATIO <= TOLERANCE:
        target_w, target_h = w, h
    else:
        box, taller = crop_box(w, h, "center")
        target_w, target_h = box[2] - box[0], box[3] - box[1]
        anchored = confirm_crop(w, h, target_w, target_h, taller)
        if anchored is None:
            print(f"{source.name} : crop annulé — aucune carte créée, original conservé.\n")
            return None, None
        box, _ = crop_box(w, h, anchored)
        im = im.crop(box)
        cropped = True

    info = {
        "real_format": real_fmt,
        "final_size": im.size,
        "ratio": im.size[0] / im.size[1],
        "anchor": anchored,
        "cropped": cropped,
    }
    return im, info


def encode_webp(im, output_path):
    """Écrit un VRAI WebP (encodage Pillow) à destination. Retourne True/False."""
    try:
        im.save(output_path, "WEBP", quality=WEBP_QUALITY)
    except OSError as exc:
        print(f"ERREUR : échec de l'encodage WebP de {output_path.name} ({exc}).")
        return False
    return True


def add(count):
    """Ajoute `count` cartes depuis cards_img/unused : chaque image est
    normalisée (ratio 3:4, grand côté ≤ MAX_EDGE) puis encodée en vrai WebP
    sous data/cards_img/cardN.webp. L'original reste toujours dans unused/.

    Transactionnel : cards.json n'est écrit qu'une fois toutes les images
    encodées ; en cas d'échec, les images déjà créées sont retirées.
    """
    available = available_unused()
    count = min(int(count), len(available))
    if count <= 0:
        print("Aucune image disponible dans cards_img/unused : rien à ajouter.")
        return

    cards = load_cards()
    next_id, next_image = next_numbers(cards)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    prepared = []  # (nom_fichier_final, image_pillow, entrée_carte)
    for source in random.sample(available, count):
        while (IMAGES_DIR / f"card{next_image}.webp").exists():
            next_image += 1
        im, info = prepare_image(source)
        if im is None:
            continue
        output_name = f"card{next_image}.webp"
        prepared.append((output_name, im, {
            "id": f"card-{next_id:03d}",
            "image": f"../../data/cards_img/{output_name}",
            "character": "unknown",
            "anime": "unknown",
            "quote": "unknown",
            "animation": random.choice(ANIMATIONS),
            "author": "unknown",
        }))
        next_id += 1
        next_image += 1

    if not prepared:
        print("Aucune carte ajoutée.")
        return

    written = []
    try:
        for output_name, im, _ in prepared:
            output_path = IMAGES_DIR / output_name
            if not encode_webp(im, output_path):
                output_path.unlink(missing_ok=True)
                raise RuntimeError(f"encodage WebP échoué pour {output_name}")
            written.append(output_path)
        for _, _, entry in prepared:
            cards.append(entry)
        save_cards(cards)
    except BaseException:
        # Transaction : on retire les images créées si cards.json n'a pas été écrit.
        for path in written:
            path.unlink(missing_ok=True)
        raise

    print(f"{len(prepared)} carte(s) ajoutée(s) et sauvegardée(s) dans {CARDS_FILE.name}.")
    print(f"Les images sources restent disponibles dans {UNUSED_DIR.name}/.\n")


def migrate():
    """Reconvertit les images des cartes existantes via le pipeline de
    normalisation (vrais WebP, ratio 3:4, grand côté ≤ MAX_EDGE) SANS modifier
    cards.json : les chemins cardN.webp restent identiques.

    L'original de chaque image migrée est d'abord copié dans unused/ sous le
    nom «original-cardN.*» (préfixe ignoré par `available_unused`), donc
    jamais écrasé. Une carte déjà en vrai WebP conforme est laissée intouchée
    (idempotent). Le traitement est le même pour toutes les cartes — aucun
    cas particulier (card6 suit exactement le même parcours)."""
    cards = load_cards()
    UNUSED_DIR.mkdir(parents=True, exist_ok=True)
    changed = skipped = failed = 0

    for card in cards:
        image_field = str(card.get("image", ""))
        m = CARD_IMAGE_RE.search(image_field)
        if not m:
            print(f"- {card.get('id')} : image non reconnue («{image_field}») — ignorée.")
            continue
        number = int(m.group(1))
        src = IMAGES_DIR / f"card{number}.webp"
        if not src.is_file():
            print(f"- {card.get('id')} : {src.name} introuvable — ignorée.")
            continue

        im, real_fmt = load_image_file(src)
        if im is None:
            failed += 1
            continue

        if real_fmt == "WEBP":
            w, h = im.size
            if max(w, h) <= MAX_EDGE and abs(w / h - TARGET_RATIO) / TARGET_RATIO <= TOLERANCE:
                print(f"- {card.get('id')} : déjà un vrai WebP conforme — inchangée.")
                skipped += 1
                continue

        backup = UNUSED_DIR / f"original-card{number}{src.suffix}"
        try:
            shutil.copy2(src, backup)
        except OSError as exc:
            print(f"- {card.get('id')} : impossible de conserver l'original ({exc}) — ignorée.")
            failed += 1
            continue

        im2, info = prepare_image(src)
        if im2 is None:
            failed += 1
            continue

        tmp = IMAGES_DIR / f".{src.name}.tmp"
        if not encode_webp(im2, tmp):
            failed += 1
            continue
        tmp.replace(src)  # remplacement atomique par le WebP normalisé
        changed += 1

    print(f"\nMigration terminée : {changed} reconvertie(s), {skipped} déjà conforme(s), "
          f"{failed} en échec.")
    print(f"Les originaux sont conservés dans {UNUSED_DIR.name}/ (préfixe «original-»).")


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
    print("  1 · add N       ajouter N cartes (images normalisées, WebP)")
    print("  2 · complete    compléter les champs manquants")
    print("  3 · animate     réattribuer les animations")
    print("  4 · migrate     reconvertir les images existantes en WebP normalisé")
    choice = input("\nChoix [défaut 2 · complete] : ").strip().lower()
    if choice in {"add", "1"}:
        value = input("Combien de cartes ajouter ? [défaut 1] : ").strip()
        add(int(value) if value.isdigit() else 1)
    elif choice in {"animate", "3"}:
        animate()
    elif choice in {"migrate", "4"}:
        migrate()
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
    elif first == "migrate":
        migrate()
    elif first == "complete":
        complete()
    elif first == "animate":
        animate()
    else:
        print(f"Commande inconnue : {first}\n")
        show_menu()


if __name__ == "__main__":
    main(sys.argv[1:])