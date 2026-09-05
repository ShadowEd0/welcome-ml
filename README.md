# ✦ WELCOME ML

**WELCOME ML** est une expérience web immersive, interactive et personnalisable construite avec **React, TypeScript, Vite, Canvas 2D, CSS et JSON**.

Le projet combine plusieurs univers visuels, des effets animés, des cartes personnalisées et une interface minimaliste afin de créer une expérience vivante et évolutive.

---

## ✨ Fonctionnalités

* 🌌 Plusieurs univers visuels
* ✦ Particules et effets animés
* 💗 Cœurs, étoiles, pétales, papillons, lucioles, pluie, brume, etc.
* 🎨 Palettes de couleurs propres à chaque univers
* 🎲 Randomisation intelligente
* ⏱ Changement automatique d'univers toutes les 7 minutes
* 💌 Cartes interactives avec animations
* 🃏 Cartes flottantes
* 🔄 Cartes avec retournement 3D
* 📱 Interface responsive
* 👆 Support tactile et gestes mobiles
* ⚙️ Réglages de qualité, intensité, vitesse et effets
* 💾 Sauvegarde des préférences avec `localStorage`
* 🚀 Fonctionnement entièrement côté client
* 📦 Architecture modulaire et extensible

---

# 📁 Structure du projet

```text
welcome-ml/
│
├── data/
│   ├── cards.json
│   ├── cards_img/
│   │   ├── image-1.webp
│   │   ├── image-2.webp
│   │   └── ...
│   │
│   └── universes/
│       ├── cosmos.json
│       ├── sakura.json
│       ├── love.json
│       ├── enchanted.json
│       ├── rain.json
│       ├── sunset.json
│       ├── ocean.json
│       └── fantasy.json
│
├── src/
│   ├── core/
│   ├── visual-engine/
│   ├── universes/
│   ├── cards/
│   ├── ui/
│   ├── settings/
│   └── utils/
│
├── public/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

# 💌 Ajouter une nouvelle carte

Les cartes sont définies dans :

```text
data/cards.json
```

Les images des cartes sont stockées dans :

```text
data/cards_img/
```

## 1. Ajouter l'image

Place l'image dans :

```text
data/cards_img/
```

Il est recommandé d'utiliser :

* `.webp`
* format portrait
* ratio environ `2:3` ou `3:4`
* environ `800 × 1200 px`
* image sans texte intégré

Exemple :

```text
data/cards_img/manuella-01.webp
```

---

## 2. Ajouter la carte dans `cards.json`

Ajoute un nouvel objet dans la liste des cartes.

Exemple :

```json
{
  "id": "card-01",
  "image": "./cards_img/manuella-01.webp",
  "character": "Personnage",
  "anime": "Anime",
  "quote": "Une phrase qui apparaît au dos de la carte.",
  "author": "Auteur",
  "animation": "heart_burst"
}
```

### Propriétés

| Propriété   | Description                        | Obligatoire |
| ----------- | ---------------------------------- | ----------- |
| `id`        | Identifiant unique de la carte     | Oui         |
| `image`     | Chemin vers l'image                | Oui         |
| `character` | Personnage affiché sur la carte    | Oui         |
| `anime`     | Anime associé                      | Oui         |
| `quote`     | Texte au dos                       | Oui         |
| `author`    | Auteur de la citation              | Non         |
| `animation` | Animation déclenchée à l'ouverture | Non         |

Si `author` n'est pas renseigné, il est simplement masqué.

Si l'animation est inconnue, la carte utilise automatiquement `none`.

---

# 🌌 Ajouter un nouvel univers

Les univers sont stockés dans :

```text
data/universes/
```

Chaque univers possède son propre fichier JSON.

Par exemple :

```text
data/universes/
├── cosmos.json
├── sakura.json
├── love.json
└── mon-univers.json
```

## 1. Créer le fichier

Crée :

```text
data/universes/mon-univers.json
```

Exemple :

```json
{
  "id": "mon-univers",
  "name": "Mon Univers",
  "palette": [
    "#ffffff",
    "#ffb7d5",
    "#c8a2ff"
  ],
  "background": {
    "type": "gradient"
  },
  "effects": [
    "stars",
    "hearts",
    "sparkles"
  ],
  "atmosphere": {
    "glow": 0.8,
    "mist": 0.2
  },
  "intensity": 0.8,
  "density": 0.7,
  "speed": 0.5,
  "interaction": {
    "pointer": true
  },
  "performance": {
    "maxParticles": 500
  }
}
```

---

## 🎨 La palette

La palette définit les couleurs principales de l'univers.

Elle peut être utilisée par différents éléments visuels :

* particules
* cœurs
* étoiles
* halos
* effets lumineux
* arrière-plans
* autres effets compatibles

Exemple :

```json
"palette": [
  "#ffb7d5",
  "#ffd6ec",
  "#c8a2ff",
  "#ffffff"
]
```

Une bonne palette doit généralement contenir plusieurs couleurs compatibles plutôt qu'une seule couleur.

---

## ✦ Les effets

Les effets sont sélectionnés dans :

```json
"effects": [
  "stars",
  "hearts",
  "sparkles"
]
```

Utilise uniquement les identifiants d'effets réellement disponibles dans le moteur.

Exemple :

```text
stars
shooting-stars
hearts
petals
butterflies
fireflies
rain
mist
particles
glow
```

Les nouveaux effets peuvent ensuite être ajoutés au moteur sans devoir modifier les univers existants.

---

## 🎛 Intensité, densité et vitesse

Ces valeurs permettent de contrôler l'ambiance de l'univers.

```json
"intensity": 0.8,
"density": 0.7,
"speed": 0.5
```

En général :

* `intensity` contrôle la puissance visuelle
* `density` contrôle la quantité d'éléments
* `speed` contrôle la vitesse des animations

Utilise des valeurs raisonnables afin de conserver de bonnes performances.

---

# ✨ Ajouter une nouvelle animation de carte

Les animations des cartes se trouvent dans :

```text
src/cards/animations/
```

Les animations disponibles peuvent être utilisées directement dans `cards.json`.

Exemple :

```json
"animation": "heart_burst"
```

Pour créer une nouvelle animation :

1. Créer son module dans `src/cards/animations/`
2. Respecter le système d'animation existant
3. L'enregistrer dans le système de gestion des animations
4. Utiliser son identifiant dans `cards.json`
5. Tester son comportement sur desktop et mobile

Une animation ne doit pas contenir de logique spécifique à une carte particulière.

Elle doit rester réutilisable.

---

# ⚙️ Personnalisation

L'interface permet notamment de modifier :

* Univers
* Intensité
* Vitesse
* Qualité graphique
* Effets
* Cartes flottantes
* Nombre de cartes flottantes
* Préférences visuelles

Les préférences sont conservées localement grâce à `localStorage`.

Les niveaux de qualité disponibles sont :

```text
AUTO
LOW
MEDIUM
HIGH
ULTRA
```

Le mode `AUTO` est recommandé.

---

# 🎲 Randomize

Le bouton **✦ Randomize** génère une nouvelle combinaison visuelle en tenant compte notamment :

* des palettes
* des effets compatibles
* de l'intensité
* de la densité
* de la vitesse
* des contraintes de performance
* des univers récemment utilisés

Le système évite autant que possible de sélectionner immédiatement le même univers.

---

# ⏱ Changement automatique

L'univers change automatiquement toutes les :

```text
7 minutes
```

Un changement manuel ou une randomisation réinitialise le compte à rebours.

L'animation d'ouverture `WELCOME ML` n'est pas rejouée lors d'un changement d'univers.

---

# 🚀 Installation

Cloner le projet :

```bash
git clone <repository-url>
cd welcome-ml
```

Installer les dépendances :

```bash
npm install
```

Lancer le serveur de développement :

```bash
npm run dev
```

Créer une version de production :

```bash
npm run build
```

Prévisualiser la version de production :

```bash
npm run preview
```

---

# 🛡️ Règles importantes

### Ne pas modifier inutilement le moteur

Pour créer un nouvel univers, privilégier une nouvelle configuration JSON.

### Ne pas mélanger les responsabilités

* `core/` → logique centrale
* `visual-engine/` → rendu et effets
* `universes/` → gestion des univers
* `cards/` → cartes et animations
* `ui/` → interface
* `settings/` → préférences
* `data/` → contenu et configurations

### Les erreurs doivent être tolérées

Une donnée invalide ne doit pas faire planter toute l'application.

Exemples :

* image manquante → fallback
* auteur absent → auteur masqué
* animation inconnue → `none`
* effet inconnu → ignoré
* stockage indisponible → valeurs par défaut

---

# 🧪 Vérification après modification

Après avoir ajouté une carte, un univers ou une animation :

```bash
npm run build
```

Puis vérifier :

* absence d'erreurs TypeScript
* chargement correct de l'application
* affichage correct de l'image
* fonctionnement de l'animation
* changement d'univers
* comportement mobile
* absence de ralentissement anormal

---

# 📄 Licence

Projet personnel.

Les contenus, images et éléments créatifs ajoutés au projet peuvent être soumis à leurs propres droits d'utilisation.

---

## ✦ WELCOME ML

**A modular universe of colors, particles, cards and tiny details.**
