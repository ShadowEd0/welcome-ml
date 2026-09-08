#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gestion des cartes du site via data/cards.json.

Usage:
    python add_card.py                -> menu interactif
    python add_card.py <n>            -> ajoute n cartes (raccourci)
    python add_card.py add <n>        -> ajoute n cartes depuis cards_img/unused
    python add_card.py animate        -> réattribue aléatoirement une animation par carte
    python add_card.py migrate        -> reconvertit les images des cartes existantes
                                         en vrais WebP normalisés (3:4, <= 1200 px)

Pipeline d'import des images :
    image brute -> data/cards_img/unused/ -> add_card.py add N ->
    analyse du format réel (Pillow) -> normalisation (mode couleur, taille) ->
    crop éventuel vers le ratio 3:4 (sans déformation) ->
    encodage WebP (qualité 82) -> data/cards_img/cardN.webp -> carte ajoutée à cards.json.
    L'image source est **déplacée** (supprimée de unused/) après succès de l'encodage
    et de la sauvegarde de cards.json. Elle ne reste donc pas dans unused/.

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
# L'original est supprimé de unused/ après encodage réussi et sauvegarde de cards.json.
# unused/ ne contient donc que les images encore disponibles pour de futures cartes.
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

# Effets de transition / sélection de carte ("burst" joué à l'ouverture
# d'une carte dans le viewer — voir src/cards/animations/index.tsx ->
# CardAnimationOverlay, alimenté par CardConfig.animation).
# CE NE SONT PAS des animations de verso : ils ne touchent jamais le dos
# des cartes. Liste miroir de src/core/contracts.ts -> RANDOMIZABLE_ANIMATIONS.
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

# Vraies animations GRAPHIQUES de verso (17) : scènes enregistrées dans
# src/cards/verso/scenes/index.ts, hors animations texte. Utilisables par
# une carte via CardConfig.verso / versoPool, rendues par le système verso
# (FlipCard.resolveVerso -> VersoAnimationRenderer -> registry).
VERSO_ANIMATIONS = [
    "breathing_rings",
    "ink_tide",
    "light_tailor",
    "sketchbook_living",
    "porcelain_memory",
    "floating_watercolor",
    "retable_miniature",
    "prism_obsidian",
    "celestial_constellation",
    "paper_origami",
    "liquid_gold",
    "vaporwave_sun",
    "starfield_heart",
    "origami_heart",
    "trigonometric_heart",
    "geometric_morphing",
    "floral_bloom",
]

# Animations TEXTUELLES de verso (7) — famille indépendante.
# IDs exacts du registre (voir src/cards/verso/scenes/index.ts).
# add_card.py choisit automatiquement l'une d'elles pour chaque message.
TEXT_ANIMATIONS = [
    "ink_text",
    "light_text",
    "breath_text",
    "float_text",
    "reveal_text",
    "liquid_text",
    "morph_text",
]

# Message par défaut lorsque l'utilisateur choisit « avec message »
# mais valide le champ sans rien saisir.
DEFAULT_MESSAGE = "?"

# Valeurs de sortie (menu / crop / saisies), hors complétion de texte.
QUIT_WORDS = {"quit", "exit", "-q"}

CARD_ID_RE = re.compile(r"card-(\d+)")
CARD_IMAGE_RE = re.compile(r"card(\d+)\.(?:webp|png|jpe?g)")

# ---------------------------------------------------------------------------
# Randomisation équilibrée (sac mélangé / shuffle bag).
#
# Remplace le hasard indépendant (random.choice) par un tirage équilibré sans
# répétition, appliqué INDÉPENDAMMENT à TROIS familles distinctes :
#
#   1. EFFETS DE TRANSITION  (ANIMATIONS, propriété CardConfig.animation) :
#      bursts discrets joués à l'ouverture de la carte dans le viewer.
#   2. VERSO GRAPHIQUE       (VERSO_ANIMATIONS, propriété CardConfig.verso) :
#      les 17 scènes graphiques du dos de carte.
#   3. VERSO TEXTE           (TEXT_ANIMATIONS, propriété CardConfig.messageAnimation) :
#      les 7 scènes texte du message.
#
# Persistance : AUCUN fichier d'état. L'état de chaque sac est reconstruit à
# chaque exécution depuis cards.json — le nombre d'utilisations déjà
# enregistrées de chaque animation définit son niveau de départ :
#   - transition  <- champ "animation" ;
#   - verso       <- champ "verso" (les versoPool sont des possibilités, pas
#     des attributions : ils ne comptent pas) ;
#   - texte       <- champ "messageAnimation".
# Un tirage choisit toujours AU HASARD parmi les animations les moins
# utilisées :
#   - une animation ne peut pas être re-tirée avant que toutes les autres
#     aient atteint son niveau (aucune répétition dans un cycle) ;
#   - l'écart max-min entre compteurs reste <= 1 sur le long terme ;
#   - l'ordre reste aléatoire (égalités tirées au hasard à chaque tirage).
# Les compteurs sont ensuite mis à jour localement au fil des ajouts, pour
# que plusieurs cartes d'une même exécution s'équilibrent entre elles.
#
# Remarque rendu : pour une carte AVEC message, FlipCard.resolveVerso donne
# la priorité à l'animation texte sur le verso graphique ; le champ "verso"
# reste néanmoins écrit car les deux tirages sont indépendants et la donnée
# demeure valide (contracts.ts : messageAnimation « works alongside » verso).
# ---------------------------------------------------------------------------

def count_used_animations(cards, field, known):
    """Compte, pour chaque animation connue, ses utilisations dans cards.

    field : clé JSON à inspecter ("animation" ou "messageAnimation").
    Les valeurs inconnues (données historiques) sont simplement ignorées :
    elles ne faussent ni les comptes ni l'équilibrage des nouvelles cartes."""
    counts = dict.fromkeys(known, 0)
    for card in cards:
        value = card.get(field)
        if value in counts:
            counts[value] += 1
    return counts


def balanced_choice(animations, counts):
    """Tirage équilibré : une animation au hasard parmi les moins utilisées.

    Équivalent exact à un sac mélangé consommé niveau par niveau : tant qu'il
    existe une animation de niveau minimal non épuisée, seule celle-ci (ou ses
    égales) peut sortir, donc chaque animation apparaît exactement une fois
    par cycle, dans un ordre aléatoire."""
    minimum = min(counts[name] for name in animations)
    return random.choice([name for name in animations if counts[name] == minimum])


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
    sous data/cards_img/cardN.webp. L'image source est **déplacée** de unused/
    vers son fichier final (elle disparaît de unused/ après succès).

    Transactionnel : cards.json n'est écrit qu'une fois toutes les images
    encodées ; en cas d'échec, les images déjà créées sont retirées et les
    sources restent intactes dans unused/.
    """
    available = available_unused()
    count = min(int(count), len(available))
    if count <= 0:
        print("Aucune image disponible dans cards_img/unused : rien à ajouter.")
        return

    cards = load_cards()
    next_id, next_image = next_numbers(cards)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # État initial des trois sacs équilibrés, reconstruit depuis cards.json
    # (les cartes déjà présentes comptent ; elles ne sont jamais modifiées).
    transition_counts = count_used_animations(cards, "animation", ANIMATIONS)
    verso_counts = count_used_animations(cards, "verso", VERSO_ANIMATIONS)
    text_counts = count_used_animations(cards, "messageAnimation", TEXT_ANIMATIONS)

    prepared = []  # (nom_fichier_final, image_pillow, entrée_carte, source_path)
    for source in random.sample(available, count):
        while (IMAGES_DIR / f"card{next_image}.webp").exists():
            next_image += 1
        im, info = prepare_image(source)
        if im is None:
            continue
        output_name = f"card{next_image}.webp"

        # Optional message + messageAnimation for text verso.
        # Règle : message présent => messageAnimation présente (choisie
        # automatiquement), message absent => messageAnimation absente.
        message = None
        message_animation = None
        wants_message = input(f"\nAjouter un message texte au verso de {output_name} ? [o/N] : ").strip().lower()
        if wants_message in ("o", "oui", "y", "yes"):
            # Défaut « ? » si l'utilisateur valide sans rien saisir :
            # jamais de message vide en mode « avec message ».
            message = input("Message : ").strip() or DEFAULT_MESSAGE
            # Animation texte choisie automatiquement : l'utilisateur n'a rien
            # à connaître ni à saisir. Tirage équilibré (sac texte).
            message_animation = balanced_choice(TEXT_ANIMATIONS, text_counts)
            text_counts[message_animation] += 1

        # Animation graphique de VERSO : tirage équilibré (sac verso),
        # indépendant du sac texte et du sac des effets de transition.
        card_verso = balanced_choice(VERSO_ANIMATIONS, verso_counts)
        verso_counts[card_verso] += 1

        # Effet de TRANSITION à l'ouverture : tirage équilibré (sac transition).
        card_animation = balanced_choice(ANIMATIONS, transition_counts)
        transition_counts[card_animation] += 1

        entry = {
            "id": f"card-{next_id:03d}",
            "image": f"../../data/cards_img/{output_name}",
            "animation": card_animation,
            "verso": card_verso,
        }
        if message:
            entry["message"] = message
        if message_animation:
            entry["messageAnimation"] = message_animation

        prepared.append((output_name, im, entry, source))
        next_id += 1
        next_image += 1

    if not prepared:
        print("Aucune carte ajoutée.")
        return

    written = []
    try:
        for output_name, im, _, _ in prepared:
            output_path = IMAGES_DIR / output_name
            if not encode_webp(im, output_path):
                output_path.unlink(missing_ok=True)
                raise RuntimeError(f"encodage WebP échoué pour {output_name}")
            written.append(output_path)
        for _, _, entry, _ in prepared:
            cards.append(entry)
        save_cards(cards)
    except BaseException:
        # Transaction : on retire les images créées si cards.json n'a pas été écrit.
        for path in written:
            path.unlink(missing_ok=True)
        raise

    # Succès complet : on supprime les sources de unused/
    for _, _, _, source in prepared:
        try:
            source.unlink()
        except OSError as exc:
            print(f"Attention : impossible de supprimer {source.name} de unused/ ({exc}).")

    print(f"{len(prepared)} carte(s) ajoutée(s) et sauvegardée(s) dans {CARDS_FILE.name}.")
    print(f"Les images sources ont été retirées de {UNUSED_DIR.name}/.\n")


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


def animate():
    """Réattribue aléatoirement une animation à chaque carte.

    Note (audit 3 familles) : cette commande opère uniquement sur la propriété
    "animation" = EFFETS DE TRANSITION à l'ouverture (CardAnimationOverlay),
    PAS sur les animations de verso (verso / messageAnimation). C'est la
    famille correcte pour cette fonctionnalité historique : comportement
    conservé tel quel (random.choice), volontairement non équilibré."""
    cards = load_cards()
    for card in cards:
        card["animation"] = random.choice(ANIMATIONS)
    save_cards(cards)
    print(f"Animation réattribuée à {len(cards)} carte(s).")


def show_menu():
    print("Menu add_card.py :")
    print("  1 · add N       ajouter N cartes (images normalisées, WebP)")
    print("  2 · animate     réattribuer les animations")
    print("  3 · migrate     reconvertir les images existantes en WebP normalisé")
    print("  4 · quitter")
    choice = input("\nChoix [défaut 4 · quitter] : ").strip().lower()
    if choice in {"add", "1"}:
        value = input("Combien de cartes ajouter ? [défaut 1] : ").strip()
        add(int(value) if value.isdigit() else 1)
    elif choice in {"animate", "2"}:
        animate()
    elif choice in {"migrate", "3"}:
        migrate()
    # "4", entrée vide ou choix inconnu -> on quitte proprement.


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
    elif first == "animate":
        animate()
    else:
        print(f"Commande inconnue : {first}\n")
        show_menu()


if __name__ == "__main__":
    main(sys.argv[1:])