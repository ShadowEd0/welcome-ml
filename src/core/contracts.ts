/** Shared, framework-agnostic contracts for the WELCOME ML experience. */

export type Identifier = string;

export type QualityLevel = "AUTO" | "LOW" | "MEDIUM" | "HIGH" | "ULTRA";

export type KnownEffectKind =
  | "stars"
  | "shooting-stars"
  | "hearts"
  | "petals"
  | "butterflies"
  | "fireflies"
  | "rain"
  | "mist"
  | "particles"
  | "glow"
  | "halos";

/**
 * A string is intentionally accepted so malformed or future JSON can be
 * handled by a registry without preventing the rest of a universe from loading.
 */
export type EffectKind = KnownEffectKind | (string & {});

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent?: string;
  background?: string;
  text?: string;
}

export interface BackgroundConfig {
  type: "solid" | "linear-gradient" | "radial-gradient" | "image" | "custom";
  colors?: string[];
  imageUrl?: string;
  opacity?: number;
}

export interface AtmosphereConfig {
  intensity?: number;
  blur?: number;
  vignette?: number;
  ambientLight?: number;
}

export interface VisualEffectConfig {
  id: Identifier;
  type: EffectKind;
  enabled?: boolean;
  intensity?: number;
  density?: number;
  speed?: number;
  opacity?: number;
  /** Effect-specific declarative settings. This is data, never executable code. */
  parameters?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface UniverseConfig {
  id: Identifier;
  name: string;
  palette: ColorPalette;
  background: BackgroundConfig;
  effects: readonly VisualEffectConfig[];
  atmosphere?: AtmosphereConfig;
  tags?: readonly string[];
}

export type CardAnimation =
  | "heart_burst"
  | "sparkles"
  | "petals"
  | "butterflies"
  | "fireflies"
  | "stars"
  | "glow"
  | "confetti"
  | "none";

export const KNOWN_CARD_ANIMATIONS: readonly CardAnimation[] = [
  "heart_burst",
  "sparkles",
  "petals",
  "butterflies",
  "fireflies",
  "stars",
  "glow",
  "confetti",
  "none",
];

/** Maps untrusted card JSON to the guaranteed no-op animation when unknown. */
export function normalizeCardAnimation(value: unknown): CardAnimation {
  return typeof value === "string" && KNOWN_CARD_ANIMATIONS.includes(value as CardAnimation)
    ? value as CardAnimation
    : "none";
}

export interface CardConfig {
  id: Identifier;
  image: string;
  character: string;
  anime: string;
  quote: string;
  author?: string;
  animation?: CardAnimation | (string & {});
}

export interface EffectPreferences {
  disabledEffectIds: readonly Identifier[];
  intensity?: number;
  speed?: number;
}

export interface FloatingCardSettings {
  enabled: boolean;
  count: number;
}

export interface InterfacePreferences {
  reducedMotion: boolean;
  menuCollapsed: boolean;
}

export interface UserPreferences {
  selectedUniverseId?: Identifier;
  quality: QualityLevel;
  intensity: number;
  speed: number;
  effects: EffectPreferences;
  floatingCards: FloatingCardSettings;
  interface: InterfacePreferences;
}

export const DEFAULT_PREFERENCES: Readonly<UserPreferences> = Object.freeze({
  quality: "AUTO",
  intensity: 1,
  speed: 1,
  effects: { disabledEffectIds: [] },
  floatingCards: { enabled: true, count: 3 },
  interface: { reducedMotion: false, menuCollapsed: true },
});

export type SceneChangeReason = "initial" | "manual" | "automatic" | "randomize";
export type TransitionPhase = "idle" | "transitioning";

export interface TransitionConfig {
  durationMs: number;
  style?: "crossfade" | "dissolve" | "fade-through-black" | "custom";
}

export interface SceneTransition {
  phase: TransitionPhase;
  fromSceneId?: Identifier;
  toSceneId?: Identifier;
  startedAt?: number;
  config: TransitionConfig;
}

export interface SceneState {
  currentSceneId: Identifier;
  previousSceneId?: Identifier;
  lastChangeReason: SceneChangeReason;
  transition: SceneTransition;
  autoChangeIntervalMs: number;
  nextAutomaticChangeAt?: number;
}

export interface SceneChangeEvent {
  fromSceneId: Identifier;
  toSceneId: Identifier;
  reason: SceneChangeReason;
  transition: SceneTransition;
}

export interface SceneManager {
  readonly state: SceneState;
  start(): void;
  stop(): void;
  changeScene(sceneId: Identifier, reason?: Exclude<SceneChangeReason, "initial">): boolean;
  resetAutomaticChangeTimer(): void;
  subscribe(listener: (state: SceneState) => void): () => void;
  dispose(): void;
}

export interface EffectContext {
  readonly canvas: HTMLCanvasElement;
  readonly quality: QualityProfile;
  readonly universe: UniverseConfig;
}

/** Lifecycle implemented by visual-engine effects; Core never renders effects. */
export interface VisualEffect {
  initialize(context: EffectContext): void;
  update(deltaMs: number): void;
  render(context: CanvasRenderingContext2D): void;
  resize(width: number, height: number, pixelRatio: number): void;
  destroy(): void;
}

export interface EffectFactory {
  readonly type: KnownEffectKind;
  create(config: VisualEffectConfig): VisualEffect;
}

export interface QualityProfile {
  level: Exclude<QualityLevel, "AUTO">;
  particleMultiplier: number;
  densityMultiplier: number;
  animationFps: number;
  canvasResolutionMultiplier: number;
  allowExpensiveEffects: boolean;
}

export interface PerformanceState {
  preferredQuality: QualityLevel;
  effectiveQuality: Exclude<QualityLevel, "AUTO">;
  profile: QualityProfile;
  documentHidden: boolean;
  averageFrameMs?: number;
}

export interface PerformanceManager {
  readonly state: PerformanceState;
  setQuality(level: QualityLevel): void;
  setDocumentHidden(hidden: boolean): void;
  reportFrame(frameDurationMs: number): void;
  subscribe(listener: (state: PerformanceState) => void): () => void;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PersistenceService {
  isAvailable(): boolean;
  save<T>(key: string, value: T): boolean;
  load<T>(key: string, fallback: T): T;
  reset(key: string): boolean;
}
