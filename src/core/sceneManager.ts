import type {
  Identifier,
  SceneChangeReason,
  SceneManager,
  SceneState,
  TransitionConfig,
} from "./contracts";

export const DEFAULT_AUTOMATIC_SCENE_INTERVAL_MS = 7 * 60 * 1000;

const DEFAULT_TRANSITION: TransitionConfig = { durationMs: 1_200, style: "crossfade" };

export interface SceneManagerOptions {
  sceneIds: readonly Identifier[];
  initialSceneId: Identifier;
  automaticChangeIntervalMs?: number;
  transition?: TransitionConfig;
  now?: () => number;
  onAutomaticChange?: (currentSceneId: Identifier) => Identifier | undefined;
}

/**
 * Owns scene timing and transition metadata. Rendering modules subscribe to its
 * state and decide how to render the declared transition.
 */
export class DefaultSceneManager implements SceneManager {
  private readonly listeners = new Set<(state: SceneState) => void>();
  private readonly sceneIds: readonly Identifier[];
  private readonly intervalMs: number;
  private readonly transition: TransitionConfig;
  private readonly now: () => number;
  private readonly chooseNext: (currentSceneId: Identifier) => Identifier | undefined;
  private automaticTimer?: ReturnType<typeof setTimeout>;
  private transitionTimer?: ReturnType<typeof setTimeout>;
  private running = false;
  private currentState: SceneState;

  public constructor(options: SceneManagerOptions) {
    if (!options.sceneIds.includes(options.initialSceneId)) {
      throw new Error("initialSceneId must be present in sceneIds.");
    }

    this.sceneIds = options.sceneIds;
    this.intervalMs = options.automaticChangeIntervalMs ?? DEFAULT_AUTOMATIC_SCENE_INTERVAL_MS;
    this.transition = options.transition ?? DEFAULT_TRANSITION;
    this.now = options.now ?? Date.now;
    this.chooseNext = options.onAutomaticChange ?? ((current) => this.nextSceneId(current));
    this.currentState = {
      currentSceneId: options.initialSceneId,
      lastChangeReason: "initial",
      autoChangeIntervalMs: this.intervalMs,
      transition: { phase: "idle", config: this.transition },
    };
  }

  public get state(): SceneState {
    return this.currentState;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.resetAutomaticChangeTimer();
  }

  public stop(): void {
    this.running = false;
    this.clearAutomaticTimer();
    this.update({ ...this.currentState, nextAutomaticChangeAt: undefined });
  }

  public changeScene(sceneId: Identifier, reason: Exclude<SceneChangeReason, "initial"> = "manual"): boolean {
    if (!this.sceneIds.includes(sceneId)) return false;

    if (reason === "manual" || reason === "randomize") this.resetAutomaticChangeTimer();
    if (sceneId === this.currentState.currentSceneId) return true;

    this.clearTransitionTimer();
    const startedAt = this.now();
    this.update({
      ...this.currentState,
      previousSceneId: this.currentState.currentSceneId,
      currentSceneId: sceneId,
      lastChangeReason: reason,
      transition: {
        phase: "transitioning",
        fromSceneId: this.currentState.currentSceneId,
        toSceneId: sceneId,
        startedAt,
        config: this.transition,
      },
    });
    this.transitionTimer = setTimeout(() => {
      this.update({ ...this.currentState, transition: { phase: "idle", config: this.transition } });
    }, this.transition.durationMs);

    if (reason === "automatic") this.resetAutomaticChangeTimer();
    return true;
  }

  public resetAutomaticChangeTimer(): void {
    if (!this.running) return;
    this.clearAutomaticTimer();
    const nextAutomaticChangeAt = this.now() + this.intervalMs;
    this.update({ ...this.currentState, nextAutomaticChangeAt });
    this.automaticTimer = setTimeout(() => this.runAutomaticChange(), this.intervalMs);
  }

  public subscribe(listener: (state: SceneState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public dispose(): void {
    this.stop();
    this.clearTransitionTimer();
    this.listeners.clear();
  }

  private runAutomaticChange(): void {
    if (!this.running) return;
    const next = this.chooseNext(this.currentState.currentSceneId);
    if (next) this.changeScene(next, "automatic");
    else this.resetAutomaticChangeTimer();
  }

  private nextSceneId(currentSceneId: Identifier): Identifier | undefined {
    if (this.sceneIds.length < 2) return undefined;
    const currentIndex = this.sceneIds.indexOf(currentSceneId);
    return this.sceneIds[(currentIndex + 1) % this.sceneIds.length];
  }

  private update(state: SceneState): void {
    this.currentState = state;
    this.listeners.forEach((listener) => listener(this.currentState));
  }

  private clearAutomaticTimer(): void {
    if (this.automaticTimer) clearTimeout(this.automaticTimer);
    this.automaticTimer = undefined;
  }

  private clearTransitionTimer(): void {
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    this.transitionTimer = undefined;
  }
}
