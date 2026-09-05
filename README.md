# ✦ WELCOME ML

> An immersive, interactive and modular visual experience built with React, TypeScript and Canvas.

**WELCOME ML** is a personal interactive web experience designed around immersive visual universes, animated particles, customizable atmospheres and interactive cards.

The project combines a lightweight interface with a modular visual engine capable of dynamically changing between different universes, effects and color palettes.

The goal is simple: create something beautiful, fluid and personal without sacrificing performance, maintainability or extensibility.

---

## ✦ Features

### 🌌 Immersive Universes

WELCOME ML includes multiple visual universes, each with its own atmosphere, colors, effects and behavior.

Initial universes include:

* Cosmos
* Sakura
* Love
* Enchanted
* Rain
* Sunset
* Ocean
* Fantasy

The architecture is designed so that new universes can be created mainly through JSON configuration rather than modifying the visual engine.

---

### ✨ Dynamic Visual Effects

The visual engine supports modular effects such as:

* Stars
* Shooting stars
* Hearts
* Petals
* Butterflies
* Fireflies
* Rain
* Mist
* Particles
* Glow
* Color-based particle effects
* Heart formations and bursts
* Sparkles
* Constellations
* Aurora-like effects
* Nebula effects
* Light orbs
* Magical rings
* Particle waves
* Other atmospheric effects

Effects are independent modules and can be combined according to the active universe.

Unknown or unavailable effects are safely ignored instead of crashing the application.

---

### 🎨 Color-driven Visual System

Colors are not only decorative values.

Universe palettes can influence:

* Background gradients
* Particles
* Glows
* Hearts
* Stars
* Atmospheric effects
* Transitions
* Other visual elements

This allows a universe to have a coherent visual identity instead of simply changing the background.

---

### 🎲 Intelligent Randomization

The **Randomize** system does more than select a random universe.

It attempts to create visually coherent combinations by considering:

* Compatible effects
* Color palettes
* Intensity
* Density
* Speed
* Performance constraints
* Recently displayed universes

The same universe is not immediately repeated.

---

### ⏱ Automatic Universe Rotation

The active universe automatically changes every **7 minutes**.

Manual universe changes and randomization reset the timer.

The opening sequence is not replayed when changing universes.

---

### 💌 Interactive Cards

Cards provide a second layer of personalization.

Each card can contain:

* Image
* Character
* Anime
* Quote
* Author
* Animation

Supported card animations include:

* `heart_burst`
* `sparkles`
* `petals`
* `butterflies`
* `fireflies`
* `stars`
* `glow`
* `confetti`
* `none`

Unknown animation types safely fall back to `none`.

Cards can be:

* Displayed in a gallery
* Shown as floating cards
* Opened in a centered viewer
* Flipped in 3D
* Navigated with previous/next controls
* Closed by clicking outside
* Navigated with touch gestures on mobile

Up to **3 floating cards** can be displayed simultaneously.

---

### 🌠 Opening Experience

Every page load begins with a short cinematic sequence.

The sequence progressively evolves through:

1. Darkness
2. `WELCOME ML`
3. Increasing illumination
4. Particles
5. Full visual universe

The opening lasts approximately **10 seconds**.

It only occurs when the application initially loads or refreshes.

Changing universes does not restart it.

---

### ⚙️ Customization

Users can customize the experience through the compact interface.

Available settings include:

* Universe
* Visual intensity
* Animation speed
* Performance quality
* Individual effects
* Floating cards
* Number of floating cards
* Other visual preferences
* Reset to defaults

Preferences are stored locally using `localStorage`.

No account or backend is required.

---

### 📱 Responsive Experience

The application is designed for:

* Desktop
* Laptop
* Tablet
* Mobile

Interactions support:

* Mouse
* Touch
* Swipe gestures
* Keyboard navigation where appropriate

The interface adapts to smaller screens without introducing a traditional permanent navigation bar.

---

## 🧠 Architecture

WELCOME ML follows a modular architecture designed to keep data, rendering, interface and application logic separated.

```text
welcome-ml/
├── public/
│   └── assets/
│       └── cards/
│
├── src/
│   ├── core/
│   │   ├── App.tsx
│   │   ├── SceneManager.ts
│   │   ├── TransitionManager.ts
│   │   ├── PerformanceManager.ts
│   │   ├── StorageManager.ts
│   │   ├── contracts.ts
│   │   └── types.ts
│   │
│   ├── visual-engine/
│   │   ├── VisualEngine.ts
│   │   ├── EffectManager.ts
│   │   ├── ParticleSystem.ts
│   │   └── effects/
│   │       ├── stars/
│   │       ├── shooting-stars/
│   │       ├── hearts/
│   │       ├── petals/
│   │       ├── butterflies/
│   │       ├── fireflies/
│   │       ├── rain/
│   │       ├── mist/
│   │       ├── particles/
│   │       └── glow/
│   │
│   ├── universes/
│   │   ├── UniverseManager.ts
│   │   ├── UniverseLoader.ts
│   │   ├── UniverseValidator.ts
│   │   └── Randomizer.ts
│   │
│   ├── cards/
│   │   ├── CardManager.ts
│   │   ├── Card.tsx
│   │   ├── CardGallery.tsx
│   │   ├── FloatingCards.tsx
│   │   ├── CardViewer.tsx
│   │   └── animations/
│   │
│   ├── ui/
│   │   ├── MenuButton.tsx
│   │   ├── MenuPanel.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── Navigation.tsx
│   │   └── ...
│   │
│   ├── settings/
│   │   ├── SettingsManager.ts
│   │   └── defaults.ts
│   │
│   └── utils/
│
├── data/
│   ├── cards.json
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
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🧩 Design Principles

### Separation of responsibilities

Each major system has a clearly defined responsibility.

```text
Core
 │
 ├── Application lifecycle
 ├── Scene management
 ├── Transitions
 ├── Persistence
 └── Performance
        │
        ▼
Visual Engine
 │
 ├── Effects
 ├── Particles
 ├── Rendering
 └── Atmosphere
        │
        ▼
Universes
 │
 ├── JSON configuration
 ├── Validation
 ├── Selection
 └── Randomization
        │
        ▼
Cards
 │
 ├── Gallery
 ├── Floating cards
 ├── Viewer
 └── Animations
        │
        ▼
UI / Settings
```

The systems communicate through shared contracts rather than tightly coupling their internal implementations.

---

## 📦 Data-driven Universes

Universes are primarily defined through JSON.

A universe can describe properties such as:

```json
{
  "id": "cosmos",
  "name": "Cosmos",
  "palette": [],
  "background": {},
  "effects": [],
  "atmosphere": {},
  "intensity": 0.8,
  "density": 0.7,
  "speed": 0.5,
  "interaction": {},
  "performance": {}
}
```

This approach allows the visual experience to evolve without rewriting the rendering engine for every new universe.

### Adding a universe

A new universe should generally consist of:

1. Creating a new JSON configuration.
2. Selecting existing compatible effects.
3. Defining its palette.
4. Defining its atmosphere.
5. Defining intensity, density and speed.
6. Validating the configuration.
7. Testing its performance.

The visual engine should not need to be rewritten simply because a new universe is added.

---

## 🖼️ Adding Cards

Cards are configured through:

```text
data/cards.json
```

Images are stored locally in:

```text
public/assets/cards/
```

A card can contain:

```json
{
  "id": "example-card",
  "image": "/assets/cards/example.webp",
  "character": "Character",
  "anime": "Anime",
  "quote": "A memorable quote.",
  "author": "Author",
  "animation": "heart_burst"
}
```

Recommended image characteristics:

* Local file
* WebP preferred
* Portrait orientation
* Approximately 2:3 or 3:4
* Around 800×1200px when appropriate
* No text embedded in the image

Images are loaded lazily where appropriate.

If an image is missing or broken, the application should display a graceful fallback rather than crash.

---

## ⚡ Performance

Performance is treated as a first-class requirement.

The application supports five quality levels:

```text
AUTO
LOW
MEDIUM
HIGH
ULTRA
```

### Performance strategies

The visual engine uses techniques such as:

* `requestAnimationFrame`
* Bounded particle counts
* Object reuse where useful
* Proper cleanup
* Canvas rendering for particle-heavy effects
* CSS/SVG for lightweight interface effects
* Lazy image loading
* Reduced rendering when the page is hidden
* Responsive canvas resizing
* Performance-aware effect configuration

The system should avoid:

* Thousands of unnecessary DOM elements
* Uncontrolled particle creation
* Repeated event listener registration
* Memory leaks
* Unnecessary React re-renders
* Heavy effects on low-performance devices

AUTO mode should adapt the visual workload to the device when possible.

---

## 💾 Persistence

User preferences are stored locally.

Examples include:

* Current universe
* Quality level
* Intensity
* Speed
* Enabled/disabled effects
* Floating card settings
* UI preferences

Storage is handled through the application's persistence layer rather than being scattered throughout individual components.

If local storage is unavailable or corrupted, the application should fall back to safe defaults.

---

## 🛡️ Resilience

WELCOME ML is designed to fail gracefully.

Examples:

| Situation                      | Expected behavior           |
| ------------------------------ | --------------------------- |
| Missing image                  | Display fallback            |
| Missing author                 | Hide author                 |
| Unknown animation              | Use `none`                  |
| Unknown effect                 | Ignore safely               |
| Invalid universe configuration | Reject safely               |
| Empty card collection          | Keep application functional |
| Broken localStorage            | Use defaults                |
| Unsupported configuration      | Avoid application crash     |

A configuration mistake should not bring down the entire experience.

Humanity has already invented production deployments for that purpose.

---

## 🛠️ Technology Stack

### Frontend

* React
* TypeScript
* Vite

### Rendering

* Canvas 2D
* CSS
* SVG
* WebGL only when genuinely useful

### Data

* JSON
* LocalStorage

### Development

* Git
* GitHub
* GitHub Actions

### Deployment

The project is designed to work as a static web application and can be deployed using platforms such as GitHub Pages.

No backend is required.

---

## 🚀 Installation

Clone the repository:

```bash
git clone <repository-url>
cd welcome-ml
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

---

## 🔍 Development Workflow

The project is designed around modular development.

Each major system can be developed and tested independently before integration.

Recommended workflow:

```text
Create feature
      ↓
Implement module
      ↓
Run TypeScript checks
      ↓
Build project
      ↓
Test integration
      ↓
Commit
      ↓
Push to GitHub
```

GitHub acts as the source of truth for the project.

---

## 🌿 Branching Strategy

Feature branches can be used to isolate major systems.

Example:

```text
main
│
├── agent1-core
├── agent2-visual-engine
├── agent3-universe-system
├── agent4-card-system
├── agent5-ui-experience
└── agent6-qa
```

The `main` branch should represent the latest stable integrated version.

---

## 🧪 Quality Assurance

Before considering a release stable, the application should be tested for:

### Functional behavior

* Opening sequence
* Universe switching
* Automatic 7-minute rotation
* Randomization
* Transitions
* Cards
* Card viewer
* Card animations
* Settings
* Persistence
* Reset behavior

### Technical behavior

* TypeScript compilation
* Production build
* JSON validation
* Imports and exports
* Module integration
* Runtime errors

### Performance

* Particle limits
* Canvas rendering
* Animation frame rate
* Memory usage
* Event listener cleanup
* Background-tab behavior
* Image loading

### Responsive behavior

* Desktop
* Tablet
* Mobile
* Touch
* Swipe
* Different viewport sizes

---

## 🔮 Extensibility

The architecture is intentionally designed for experimentation.

Future additions can include:

* New universes
* New visual effects
* New card animations
* New palettes
* New atmospheric systems
* New interaction patterns
* Additional performance strategies

The preferred approach is to **extend existing interfaces and modules**, not to rewrite the entire application for every new idea.

---

## 🎯 Project Philosophy

WELCOME ML is built around four principles:

**Beautiful**

The visual experience should feel atmospheric, elegant and alive.

**Personal**

Colors, universes, cards and animations should be easy to customize.

**Modular**

A new feature should not require rewriting unrelated systems.

**Performant**

Visual richness should not come at the cost of usability.

The project aims to demonstrate that a small static web application can still provide a highly immersive experience through thoughtful rendering, modular architecture and carefully designed interactions.

---

## 📄 License

This project is a personal creative project.

Unless otherwise specified, project assets and personal content should not be redistributed without permission.

---

## ✦ WELCOME ML

A small collection of code, particles, colors and unreasonable amounts of attention to tiny visual details.

Because apparently, making a beautiful webpage wasn't enough. We had to make the hearts fly too.
