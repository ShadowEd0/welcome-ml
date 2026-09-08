/**
 * The verso system: the back face of a card becomes an autonomous
 * mini-universe ("animation de verso").
 *
 * Architecture, deliberately small:
 *
 *   Card
 *     └─ animation id via CardConfig.verso
 *          └─ VersoAnimationRegistry (id → definition)
 *               └─ createVersoScene(id) → VersoScene
 *                    └─ VersoAnimationRenderer (mount / activate / destroy)
 *                         └─ scene owns its own render loop, pointer, cleanup
 *
 * A scene is a self-contained visual universe, declared technology-agnostic:
 * `mount` receives a plain DOM host element the scene may fill however it
 * needs (canvas 2D, SVG, DOM/CSS elements…). WebGL/3D would work exactly
 * the same way (an extra canvas + a webgl context) without importing any
 * engine here — no dependency is added for a hypothetical future.
 *
 * The parent component stays ignorant of the scene internals: it only asks
 * "mount the animation X in this container", then pauses / resumes it.
 */

export type VersoAnimationId = string;

/** Context handed to a scene at mount time. */
export interface VersoSceneContext {
  /** DOM container the scene may fill with the DOM it needs. */
  readonly host: HTMLElement;
  /**
   * Optional message content for text-based verso animations.
   * Provided by the card's `message` field when present.
   */
  readonly message?: string;
}

/**
 * Contract of one verso animation (one mini-universe).
 *
 * Responsibilities enforced by the scene itself:
 *  - mount: create every resource (elements, contexts) inside `host`;
 *  - setActive: start / stop the render work (pause / resume);
 *  - setReducedMotion: adapt to the prefers-reduced-motion preference;
 *  - resize: react to host size changes;
 *  - destroy: remove every RAF, timer, listener, node, resource, reference.
 */
export interface VersoScene {
  readonly id: VersoAnimationId;
  mount(context: VersoSceneContext): void;
  setActive(active: boolean): void;
  setReducedMotion(reduced: boolean): void;
  resize(): void;
  destroy(): void;
}

/** Registry entry resolving an animation id to a brand-new scene instance. */
export interface VersoAnimationDefinition {
  readonly id: VersoAnimationId;
  readonly create: () => VersoScene;
}