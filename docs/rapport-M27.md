# Rapport M27 — Enrichissement du catalogue de versos mathématiques + correction visuelle de 5 scènes

Mission : passer le catalogue `MATH_VERSO_CATALOGUE` de 13 à 28 versos (15 nouvelles scènes),
sans refactor du moteur, avec miroir exact catalogue ↔ `data/add_card.py`, puis corriger
visuellement 5 scènes identifiées comme insatisfaisantes sur le canvas de référence **318×478**.

---

## A. État trouvé après l'arrêt

| Élément | Valeur constatée |
| --- | --- |
| HEAD initial | `719d1be` (`feat: refine math verso visuals`) |
| Working tree initial | 4 fichiers modifiés + 20 fichiers non suivis, **rien n'était stagé/commité** |
| Correctif déjà appliqué avant l'arrêt | **Aucun** — les 5 scènes cibles (`attractor_silk`, `cymatic_resonance`, `log_pulsing`, `thomas_knot`, `cornu_nebula`) étaient toujours dans leur état d'origine (relecture des sources confirmée) |
| Corrections réellement reprises | **100 % nouvelles/appliquées ce jour** : aucune modification partielle pré-arrêt à préserver (machine éteinte avant toute sauvegarde) |
| Build | Un build pré-arrêt existait dans `dist/` (20:44) avec `dist/data/cards.json` patché par 15 cartes de test → restauré/dépassé par les builds de reprise |

La mission d'origine (15 nouvelles scènes) était complète dans le working tree : `catalog.ts`
(28 entrées), `add_card.py` (28 miroirs), `helpers.ts` (option `reveal` sur `makeLayer`),
`numerics.ts`, 15 fichiers de scènes, 4 nouveaux univers. Le screenshot revisuel pré-arrêt avait
flagé 5 scènes. Rien de tout cela n'était commité. Aucun commit n'a été perdu.

---

## B. Corrections par scène

Canvas de référence : **318×478 px** (centre visuel ≈ ligne 24 du quadrillage 32×48).
Inspection par sondes de luminance (moyenne et **max** par cellule — la moyenne sous-estime
les traits fins) + métriques (`white>240`, `bright>70`, `vivid>180`, overflow).

### attractor_silk

- **Problème initial** : rendu en « bande » horizontale dense, non centré, silhouette peu
  élégante, trop de points ; le nuage de Clifford n'était **jamais normalisé** (raw ±2),
  d'où une auto-fit écrasée en hauteur.
- **Cause** : `clifford()` renvoyait les valeurs brutes de l'orbit2D ; pas de `normalize`.
  De plus, `normalize` dans `numerics.ts` ne faisait que mettre à l'échelle par le pic depuis
  **l'origine** — aucun centrage sur le centroïde.
- **Correction** :
  1. `normalize()` recentre désormais sur le centroïde (points non-finis ignorés) puis
     met à l'échelle vers `target` — positionne les attracteurs au centre du canvas ;
  2. `attractor_silk` : le nuage Clifford est normalisé, densité ramenée à 2600 points
     (warmup 250), trail `silkRibbon` élargi (capacity 260, opacity 0.55), couche d'écho
     adoucie (rotation 36°, lineWidth 0.7, opacity 0.22).
- **Résultat** : composition « papillon de soie » dense mais lisible, **centrée**
  (marges L44/R30/T144/B130 → le corps occupe le centre), organique, sans voile
  (`white=0.000`, `max=205`). `mono=vrai` assumé (la scène se construit en 160 ms, la
  luminance stable vient du corps dense) — le reveal conserve du mouvement via le tracer.

### cymatic_resonance

- **Problème initial** : trop sombre, trop sparse, présence insuffisante (intensité faible).
- **Cause** : lignes fines (1.5 px) sur anneaux peu nombreux, trails faiblement opaques,
  aucune structure persistante durable — à 318×478 le motif se diluait dans le fond.
- **Correction** : réorganisation de la composition en 5 couches :
  - anneau principal `chladni(0.82)` : lineWidth 3.2, glow 2.6, trail `fadingLine`
    (capacity 220, baseOpacity 0.9, width 3) + reveal 3.8 s ;
  - 2 anneaux structurels persistants (TEAL rot 0.3, MINT rot −0.45) plus épais ;
  - anneau interne TEAL statique + halo externe AQUA animé en `orbitTrace`.
- **Résultat** : mandala cymatique **dense et lumineux couvrant tout le canvas**
  (marges L16/R34/T100/B106, `bright 160→7s = 0.077→0.078`, `max=222`, `white=0.000`).
  Structure : anneaux concentriques modulés superposés, toujours sombre en fond.

### log_pulsing

- **Problème initial** : rendu totalement lavé (`bright 7s ≈ 0.27`), halo géant blanchâtre,
  silhouette non lisible.
- **Cause** : `widthWorld: 0.35` sur une géométrie culminant à ~0.25 unités monde → le halo
  du `vanishingGlow` mesurait ~200 px après auto-fit et noyait la courbe ; ratio 30/7 de la
  hypotrochoïde produisait une silhouette confuse.
- **Correction** : `widthWorld: 0.35 → 0.05`, glow 1.3 → 1.1, lineWidth 1.9 ; amplitude ×0.45 ;
  **R/r = 4** (0.64/0.16) → silhouette « fleur » à 4 lobes propre et identifiable ; trail
  `orbitTrace` TEAL renforcé.
- **Résultat** : fleur hypotrochoïdale pulsante **contrastée et nette** (`bright 7s=0.048`,
  `max=251`, `white=0.002` soit quelques pixels), composition centrée (L40/R50/T112/B134),
  hiercarchie claire structure/effet, fond deep_ocean sombre conservé.

### thomas_knot

- **Problème initial** : trop sombre, structure noyée dans un halo informe.
- **Cause** : échantillonnage faible (1800 points, warmup 1500) + trail `silkRibbon`
  opacity 0.4 → traces trop peu lumineuses.
- **Correction** : 2600 points (warmup 2500) pour un nœud plus riche ; `silkRibbon`
  capacity 240 → 260, baseOpacity 0.4 → 0.85 ; lineWidth 1.3, glow 1.5, tracer agrandi.
- **Résultat** : nœud de Thomas reconnaissable — un treillis de fils enchevêtrés
  identifiable même à 318×478, centré, `max=255` (noyau tracer), `white=0.001`,
  `bright 7s=0.045`. Pas de halo informe.

### cornu_nebula

- **Problème initial** : structure minuscule, amas diagonaux (croix de rotations 0/π/2/π),
  mauvaise exploitation du canvas ; les couches à `reveal` sans trail s'effaçaient vite.
- **Cause** : rotations orthogonales (π/2, π) dispersant les deux bras en un X de petits
  groupes ; échelle auto-fit ramenant la spirale 1D à une fraction du canvas ; pas de
  squelette persistant.
- **Correction** :
  1. **normalize recentré** (hérité de la correction généraliste) : la spirale est centrée ;
  2. portée `range 3.0 → 2.0` → courbure plus serrée, plus de circonvolutions visibles ;
  3. **couche squelette LILAC persistante** (sans reveal, pleine luminance alpha 0.85,
     lineWidth 2.2, glow 2.4) qui garde la spirale lisible en permanence ;
  4. rotations : bras principal incliné de **1.32 rad** (exploite la hauteur portrait) +
     bloom miroir (rot π, scale 0.84) + curl interne (rot −1.05, scale 0.5).
- **Résultat** : véritable **spirale de Fresnel en nébuleuse diagonale** couvrant le canvas
  (sondes max : deux bras `+=*#` galbés sur ~2/3 du canvas), centrée, `white=0.000`,
  `max=199`. Élément horizontal « sliver » et amas diagonaux éliminés.

---

## C. Architecture

Fichiers modifiés **durant la reprise** :

- `src/cards/verso/math/scenes/catalog/numerics.ts` — `normalize()` : centrage sur le
  centroïde + filtrage des points non-finis avant mise à l'échelle.
- `src/cards/verso/math/scenes/catalog/attractorSilk.ts` — normalisation du nuage,
  densité, trails, écho.
- `src/cards/verso/math/scenes/catalog/cymaticResonance.ts` — composition 5 couches,
  épaisseurs/glows, trails.
- `src/cards/verso/math/scenes/catalog/logPulsing.ts` — paramètres géométriques (R/r=4),
  `widthWorld`, trails.
- `src/cards/verso/math/scenes/catalog/thomasKnot.ts` — échantillonnage, trails, tracer.
- `src/cards/verso/math/scenes/catalog/cornuNebula.ts` — structure des couches, portée
  spirale, rotations, squelette persistant.

**Engine : NON modifié.** Aucune modification du moteur (`engine.ts`, `renderer.ts`,
`coordinates.ts`, tracers/trails existants) ni des abstractions communes (`types.ts`) n'a été
nécessaire. Le seul outil partagé étendu est `numerics.ts` (nouveau fichier de la mission M27,
pas un fichier moteur pré-existant) ; son `normalize` recentré est utilisé par orbit3D et
eulerSpiral, donc bénéficie à `aizawa_vortex`, `shockwave_crystal` et toutes scènes associées
sans autre retouche. Conformité à la règle : « corriger dans la scène, pas dans le moteur ».

Fichiers de la mission M27 d'origine (inchangés par la reprise, hormis les 5 ci-dessus) :
`catalog.ts`, `data/add_card.py`, `helpers.ts`, plus 15 scènes et 4 univers.

---

## D. Validation

- **Type-check** : `npx tsc --noEmit` et `tsc` intégré au build → **propres**.
- **Build** : `npm run build` → OK (312.01 kB, 170 modules, `[copy-data-dir]` actif).
- **Catalogue** : `MATH_VERSO_CATALOGUE` = **28 entrées** (13 + 15), aucune régression
  (les 13 scènes M26 intactes dans les listes).
- **MATH_VERSOS (add_card.py)** : 28 ids ; script de miroir → `missing in py: []`,
  `missing in ts: []`, **`cat <-> py match: True`**.
- **`data/cards.json`** : **intouché** (absent de `git status`) ; `dist/data/cards.json`
  restauré par le build final (18 vraies cartes, 1re `card-001 damped_memory`).
  Les 15 cartes de test (`card-t01..t15`, images manquantes → 1 erreur console 404 = artefact
  du harnais, **aucun** `pageerror` JS) ont servi uniquement pour le rendu navigateur.
- **Canvas 318×478 / rendu navigateur** (Puppeteer/Edge headless, serveur http local) :
  - 1280×800 (canvas 318×478) : les 15 scènes → **toutes `ok`, aucun OVERFLOW**,
    `whiteFrac ≤ 0.002`, perçues visuellement via sondes MAX-luma.
  - Reduced-motion (`prefers-reduced-motion`) : 15/15 `ok`, aucune courbe manquante.
  - Portrait 390×844 : 15/15 `ok`, aucun overflow (auto-fit non cassé).
  - **Rappel de la règle** : l'auto-fit se fonde sur le plus petit côté (le moteur gère le
    ratio) ; les compositions se centrent via l'auto-fit + nouveau `normalize`.
- **Synchronisation finale** : miroir 28/28 vérifié après toutes les modifications.

---

## E. Git

- Avant : `719d1be` (HEAD), working tree **non commité** (4 M + 20 ??).
- Aucun commit créé avant l'arrêt ; aucune modification détruite.
- Commit de validation M27 réalisé ci-dessous (voir historial pour le hash) : `git add` ciblé
  uniquement sur le travail M27 (scènes, univers, helpers, catalog, numerics, add_card, rapport).
- `git status` final : arbre **propre** (voir section G).

Note : `docs/rapport-M26.md` n'existe pas sur disque (le répertoire `docs/` était vide) — seul
`docs/rapport-M27.md` est produit, conformément au workflow.

---

## F. Écarts et décisions

- **`dist/` est gitignoré** : le patch `dist/data/cards.json` (cartes de test) ne peut pas
  polluer le dépôt ; restauration via rebuild.
- La couche « squelette » de `cornu_nebula` et les anneaux `reveal` de `cymatic_resonance`
  utilisent l'alpha de dessin standard (0.85) prévu par le renderer pour les couches sans
  trail — persistence obtenue **sans** toucher au moteur.
- `mono=yes` (métrique) sur `attractor_silk`/`pulsar_waves`/`crystal_maurer` est un artefact
  du test progressif (corps dense déjà posé à 160 ms) ; la progression reste visible via le
  tracer et le reveal. Non bloquant.
- `max=255` sur quelques scènes : noyau blanc du tracer (dot ≤ quelques px, `whiteFrac ≤ 0.002`)
  — comportement de référence du moteur (mêmes valeurs sur les scènes M26).
- La 404 console provenait des images de cartes de test inexistantes — aucune sur le jeu réel.

---

## G. Artefacts de validation

- Scripts de reprise dans `%TEMP%\opencode` : `m27.mjs` (harness navigateur),
  `m27_1280x800.json` / `m27_390x844.json` / `m27_1280x800_reduced.json` (métriques + erreurs),
  `luma.mjs` / `lumaMax.mjs` (sondes de composition), `check_mirror.py` (miroir 28/28),
  captures `shots/m27/*`.
- Serveur de preview arrêté après validation ; `dist/data/cards.json` restauré.