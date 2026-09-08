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

Modes de verso (Mission #25) :
    Le dos de chaque nouvelle carte propose 3 modes, au choix de l'utilisateur
    (saisi au moment de la création de la carte) :
      1. random      -> verso mathématique tiré AU HASARD, de façon ÉQUILIBRÉE ;
      2. manuel      -> choix MANUEL d'un verso mathématique (PAS bloqué par
                        l'équilibrage : l'utilisateur peut répéter un verso) ;
      3. message     -> carte-message : un texte avec son animation textuelle
                        (tirée de façon équilibrée parmi les 7 scènes texte).
    L'équilibrage stricte exige qu'un verso ne soit PAS réutilisé tant que les
    autres éligibles n'ont pas atteint le même nombre d'utilisations. La liste
    des versos mathématiques (MATH_VERSOS) est le MIROIR du catalogue TypeScript
    src/cards/verso/math/catalog.ts -> MATH_VERSO_CATALOGUE. Les deux listes
    doivent rester synchronisées (voir la notice en tête de MATH_VERSOS).
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

# ---------------------------------------------------------------------------
# Versos MATHÉMATIQUES du catalogue (Mission #25).
#
# MIROIR EXACT de src/cards/verso/math/catalog.ts -> MATH_VERSO_CATALOGUE.
# Chaque id correspond à une scène finie enregistrée dans le registre verso
# (Scenes/index.ts -> MATH_VERSO_CATALOGUE -> toDefinition -> registry).
#
# POUR AJOUTER UN VERSO AU CATALOGUE :
#   1. créer la scène dans src/cards/verso/math/scenes/catalog/<id>.ts ;
#   2. l'ajouter à MATH_VERSO_CATALOGUE (catalog.ts) ;
#   3. l'ajouter ICI, à la même position idéalement.
# Le moteur mathématique n'exige AUCUN changement pour un nouveau verso.
#
# Les scènes graphiques "non-math" de la Mission #18 ont été ARCHIVÉES
# (Mission #25) dans src/cards/verso/scenes/unused/ ; elles ne sont plus
# distribuées — aucune carte ne doit plus les référencer.
MATH_VERSOS = [
    "rose_garden",
    "petal_mandala",
    "clover_meadow",
    "celestial_orbits",
    "golden_spiral",
    "cardioid_echo",
    "lemniscate_infinity",
    "lissajous_weave",
    "spirokinetic",
    "damped_memory",
    "celestial_butterfly",
    "rose_galaxy",
    "orbital_symphony",
    "quantum_lace",
    "crystal_maurer",
    "attractor_silk",
    "cymatic_resonance",
    "pulsar_waves",
    "fermat_vortex",
    "log_pulsing",
    "gielis_shield",
    "thomas_knot",
    "gabor_ripple",
    "torus_ribbon",
    "cornu_nebula",
    "aizawa_vortex",
    "rational_lens",
    "shockwave_crystal",
]
MATH_VERSO_NAMES = {
    "rose_garden": "Jardin de roses",
    "petal_mandala": "Pétale mandala",
    "clover_meadow": "Pré de trèfles",
    "celestial_orbits": "Orbites célestes",
    "golden_spiral": "Spirale dorée",
    "cardioid_echo": "Écho de cardioïde",
    "lemniscate_infinity": "Infini croisé",
    "lissajous_weave": "Tissage de Lissajous",
    "spirokinetic": "Spirokinétic",
    "damped_memory": "Mémoire amortie",
    "celestial_butterfly": "Papillon céleste",
    "rose_galaxy": "Galaxie de roses",
    "orbital_symphony": "Symphonie orbitale",
    "quantum_lace": "Dentelle quantique",
    "crystal_maurer": "Cristal de Maurer",
    "attractor_silk": "Soie d'attracteur",
    "cymatic_resonance": "Résonance cymatique",
    "pulsar_waves": "Ondes de pulsar",
    "fermat_vortex": "Vortex de Fermat",
    "log_pulsing": "Pulsation logarithmique",
    "gielis_shield": "Bouclier de Gielis",
    "thomas_knot": "Nœud de Thomas",
    "gabor_ripple": "Ondulation de Gabor",
    "torus_ribbon": "Ruban torique",
    "cornu_nebula": "Nébuleuse de Cornu",
    "aizawa_vortex": "Vortex d'Aizawa",
    "rational_lens": "Lentille rationnelle",
    "shockwave_crystal": "Cristal d'onde de choc",
}

# Animations TEXTUELLES de verso (7) — famille indépendante.
# IDs exacts du registre (voir src/cards/verso/scenes/index.ts).
# add_card.py choisit automatiquement l'une d'elles pour chaque carte-message.
TEXT_ANIMATIONS = [
    "ink_text",
    "light_text",
    "breath_text",
    "float_text",
    "reveal_text",
    "liquid_text",
    "morph_text",
]

# Message par défaut lorsque l'utilisateur choisit « message »
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
#   2. VERSO MATHÉMATIQUE    (MATH_VERSOS, propriété CardConfig.verso) :
#      les scènes mathématiques du catalogue M25 (Mission #25).
#   3. VERSO TEXTE           (TEXT_ANIMATIONS, propriété CardConfig.messageAnimation) :
#      les 7 scènes texte du message.
#
# Persistance : AUCUN fichier d'état. L'état de chaque sac est reconstruit à
# chaque exécution depuis cards.json — le nombre d'utilisations déjà
# enregistrées de chaque animation définit son niveau de départ :
#   - transition  <- champ "animation" ;
#   - verso math  <- champ "verso" (les versoPool sont des possibilités, pas
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
# Le choix MANUEL (mode « manuel ») n'est PAS soumis à l'équilibrage : la
# contrainte strecte ne s'applique qu'aux tirages au hasard.
# ---------------------------------------------------------------------------

def count_used_animations(cards, field, known):
    """Compte, pour chaque animation connue, ses utilisations dans cards.

    field : clé JSON à inspecter ("animation", "verso" ou "messageAnimation").
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


def show_usage(prefix, counts):
    """Affiche la répartition d'utilisation d'un sac (pour les stats)."""
    rows = sorted(counts.items(), key=lambda kv: (kv[1], kv[0]))
    print(f"\n  {prefix} :")
    for name, count in rows:
        label = MATH_VERSO_NAMES.get(name, name)
        print(f"    {name:<24} {count:>3}  ({label})")


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

    RÈGLE MÉTIER — l'utilisateur est l'unique source des nouvelles images :
      - les sauvegardes «original-cardN.*» créées par `migrate` sont exclues ;
      - toute image dont le nom correspond à une image déjà utilisée par une
        carte (cardN.webp) est exclue : même si un cardN.webp se retrouvait
        dans unused/, il ne pourrait jamais être recyclé par `add` ;
      - AUCUN fallback vers data/cards_img/ : si unused/ ne fournit aucune
        nouvelle image, `add` échoue explicitement (voir add())."""
    if not UNUSED_DIR.is_dir():
        return []
    used_names = {p.name for p in IMAGES_DIR.iterdir()
                  if p.is_file() and CARD_IMAGE_RE.fullmatch(p.name)}
    return sorted(p for p in UNUSED_DIR.iterdir()
                  if p.is_file()
                  and not p.name.startswith("original-")
                  and p.name not in used_names)


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


def choose_verso(math_counts, text_counts):
    """Demande au créateur le MODE de verso pour UNE carte.

    Retourne (verso, message, message_animation) — chacun peut être None :
      - mode « random » : verso mathématique équilibré, aucun message ;
      - mode « manuel » : choix manuel (liste numérotée), PAS bloqué par
        l'équilibrage, aucun message ;
      - mode « message » : carte-message, messageAnimation équilibrée, PAS de
        verso graphique (messageAnimation a priorité au rendu) ;
      - retourne None si l'utilisateur a quitté (→ quitter l'outil).
    """
    print("\nMode de verso pour cette carte :")
    print("  1 · random    tirage équilibré d'un verso mathématique")
    print("  2 · manuel    choix manuel d'un verso mathématique (sans équilibrage)")
    print("  3 · message   carte-message (animation texte équilibrée)")
    print("  4 · quitter")
    choice = input("\nChoix [défaut 1 · random] : ").strip().lower()
    if choice in {"2", "manuel", "manual", "m"}:
        print("\nVersos mathématiques du catalogue (choix libre) :")
        for i, name in enumerate(MATH_VERSOS, 1):
            label = MATH_VERSO_NAMES.get(name, name)
            print(f"  {i:>2}. {name}  ({label})")
        # Balanced stats: display current usage so a human can decide; the
        # choice itself is NOT constrained.
        show_usage("Utilisations actuelles (verso math)", math_counts)
        pick = input("\nNuméro du verso [défaut 1] : ").strip()
        if pick.lower() in QUIT_WORDS:
            return None
        try:
            index = int(pick) - 1 if pick.isdigit() else 0
            verso = MATH_VERSOS[index]
        except IndexError:
            print(f"\nChoix invalide — {MATH_VERSOS[0]} utilisé à la place.")
            verso = MATH_VERSOS[0]
        print(f"Verso choisi : {verso}")
        return verso, None, None

    if choice in {"3", "message"}:
        message = input("Message : ").strip() or DEFAULT_MESSAGE
        message_animation = balanced_choice(TEXT_ANIMATIONS, text_counts)
        text_counts[message_animation] += 1
        print(f"Animation texte choisie (équilibrée) : {message_animation}")
        return None, message, message_animation

    if choice in QUIT_WORDS or choice in {"4", "quit", "exit"}:
        return None

    # Défaut / « random ».
    verso = balanced_choice(MATH_VERSOS, math_counts)
    math_counts[verso] += 1
    print(f"Verso mathématique tiré (équilibré) : {verso}")
    return verso, None, None


def add(count, interactive=True):
    """Ajoute `count` cartes depuis cards_img/unused : chaque image est
    normalisée (ratio 3:4, grand côté ≤ MAX_EDGE) puis encodée en vrai WebP
    sous data/cards_img/cardN.webp. L'image source est **déplacée** de unused/
    vers son fichier final (elle disparaît de unused/ après succès).

    Pour chaque carte, le MODE de verso est choisi :
      - mode « random » : verso mathématique équilibré ;
      - mode « manuel » : choix manuel (pas bloqué par l'équilibrage) ;
      - mode « message » : carte-message (animation texte équilibrée).

    Transactionnel : cards.json n'est écrit qu'une fois toutes les images
    encodées ; en cas d'échec, les images déjà créées sont retirées et les
    sources restent intactes dans unused/.

    RÈGLE MÉTIER : seule une nouvelle image déposée à la main dans unused/
    peut servir de source. Si aucune n'est disponible, l'opération échoue
    explicitement, sans réutiliser aucune image déjà utilisée ni créer
    quoi que ce soit.
    """
    requested = int(count)
    available = available_unused()
    count = min(requested, len(available))
    if count <= 0:
        if requested <= 0:
            print("Aucune quantité positive demandée : rien à ajouter.")
        else:
            unused_rel = UNUSED_DIR.relative_to(DATA_DIR.parent)
            print(f"❌ Échec de l'ajout de la carte {requested}." if requested == 1
                  else f"❌ Échec de l'ajout des {requested} cartes.")
            print(f"\nAucune nouvelle image source disponible dans :")
            print(f"  {unused_rel.as_posix()}/")
            print(f"\nAucune image déjà utilisée n'a été réutilisée, aucune copie effectuée,"
                  f"\naucune carte créée ni modifiée ({CARDS_FILE.name} intact).")
            print(f"\nAjoutez manuellement une nouvelle image dans :")
            print(f"  {unused_rel.as_posix()}/")
            print(f"\nPuis relancez :")
            print(f"  python add_card.py add {requested}")
        return

    cards = load_cards()
    next_id, next_image = next_numbers(cards)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # État initial des trois sacs équilibrés, reconstruit depuis cards.json
    # (les cartes déjà présentes comptent ; elles ne sont jamais modifiées).
    transition_counts = count_used_animations(cards, "animation", ANIMATIONS)
    math_counts = count_used_animations(cards, "verso", MATH_VERSOS)
    text_counts = count_used_animations(cards, "messageAnimation", TEXT_ANIMATIONS)

    prepared = []  # (nom_fichier_final, image_pillow, entrée_carte, source_path)
    for source in random.sample(available, count):
        while (IMAGES_DIR / f"card{next_image}.webp").exists():
            next_image += 1
        im, info = prepare_image(source)
        if im is None:
            continue
        output_name = f"card{next_image}.webp"

        verso, message, message_animation = None, None, None
        if interactive:
            result = choose_verso(math_counts, text_counts)
            if result is None:
                print("\nQuitter : aucune autre carte ajoutée.")
                break
            verso, message, message_animation = result
        else:
            # Mode non-interactif : verso mathématique équilibré.
            verso = balanced_choice(MATH_VERSOS, math_counts)
            math_counts[verso] += 1

        # Effet de TRANSITION à l'ouverture : tirage équilibré (sac transition).
        card_animation = balanced_choice(ANIMATIONS, transition_counts)
        transition_counts[card_animation] += 1

        entry = {
            "id": f"card-{next_id:03d}",
            "image": f"../../data/cards_img/{output_name}",
            "animation": card_animation,
        }
        if message:
            entry["message"] = message
        if message_animation:
            entry["messageAnimation"] = message_animation
        elif verso:
            entry["verso"] = verso

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


def stats():
    """Affiche les statistiques d'équilibrage dérivées de cards.json (aucun
    compteur séparé n'existe). Répartition par famille : transitions, versos
    mathématiques, animations texte."""
    cards = load_cards()
    transition_counts = count_used_animations(cards, "animation", ANIMATIONS)
    math_counts = count_used_animations(cards, "verso", MATH_VERSOS)
    text_counts = count_used_animations(cards, "messageAnimation", TEXT_ANIMATIONS)
    print(f"\nStatistiques d'équilibrage depuis {CARDS_FILE.name} "
          f"({len(cards)} carte(s)) :")
    show_usage("Effets de transition", transition_counts)
    show_usage("Versos mathématiques", math_counts)
    show_usage("Animations texte", text_counts)
    print()


def show_menu():
    print("Menu add_card.py :")
    print("  1 · add N       ajouter N cartes (images normalisées, WebP)")
    print("  2 · animate     réattribuer les animations")
    print("  3 · migrate     reconvertir les images existantes en WebP normalisé")
    print("  4 · stats       statistiques d'équilibrage (depuis cards.json)")
    print("  5 · quitter")
    choice = input("\nChoix [défaut 5 · quitter] : ").strip().lower()
    if choice in {"add", "1"}:
        value = input("Combien de cartes ajouter ? [défaut 1] : ").strip()
        add(int(value) if value.isdigit() else 1)
    elif choice in {"animate", "2"}:
        animate()
    elif choice in {"migrate", "3"}:
        migrate()
    elif choice in {"stats", "4"}:
        stats()
    # "5", entrée vide ou choix inconnu -> on quitte proprement.


def main(args):
    if not args:
        show_menu()
        return
    first = args[0].strip().lower()
    if first.isdigit():
        add(int(first))
    elif first == "add":
        add(int(args[1]) if len(args) > 1 and args[1].isdigit() else 1)
    elif first == "stats":
        stats()
    elif first == "migrate":
        migrate()
    elif first == "animate":
        animate()
    else:
        print(f"Commande inconnue : {first}\n")
        show_menu()


if __name__ == "__main__":
    main(sys.argv[1:])