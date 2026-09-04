import type { PerformanceManager, PerformanceState, QualityLevel, QualityProfile } from "./contracts";

const QUALITY_PROFILES: Readonly<Record<Exclude<QualityLevel, "AUTO">, QualityProfile>> = {
  LOW: { level: "LOW", particleMultiplier: 0.35, densityMultiplier: 0.45, animationFps: 30, canvasResolutionMultiplier: 0.75, allowExpensiveEffects: false },
  MEDIUM: { level: "MEDIUM", particleMultiplier: 0.65, densityMultiplier: 0.7, animationFps: 45, canvasResolutionMultiplier: 1, allowExpensiveEffects: false },
  HIGH: { level: "HIGH", particleMultiplier: 1, densityMultiplier: 1, animationFps: 60, canvasResolutionMultiplier: 1, allowExpensiveEffects: true },
  ULTRA: { level: "ULTRA", particleMultiplier: 1.35, densityMultiplier: 1.25, animationFps: 60, canvasResolutionMultiplier: 1.5, allowExpensiveEffects: true },
};

export interface PerformanceManagerOptions {
  initialQuality?: QualityLevel;
  initialAutoQuality?: Exclude<QualityLevel, "AUTO">;
}

/** Coordinates a quality profile; visual modules apply the resulting profile themselves. */
export class DefaultPerformanceManager implements PerformanceManager {
  private readonly listeners = new Set<(state: PerformanceState) => void>();
  private frameSamples: number[] = [];
  private currentState: PerformanceState;

  public constructor(options: PerformanceManagerOptions = {}) {
    const preferredQuality = options.initialQuality ?? "AUTO";
    const effectiveQuality = preferredQuality === "AUTO" ? options.initialAutoQuality ?? "HIGH" : preferredQuality;
    this.currentState = { preferredQuality, effectiveQuality, profile: QUALITY_PROFILES[effectiveQuality], documentHidden: false };
  }

  public get state(): PerformanceState { return this.currentState; }

  public setQuality(level: QualityLevel): void {
    const effectiveQuality = level === "AUTO" ? this.currentState.effectiveQuality : level;
    this.setState({ ...this.currentState, preferredQuality: level, effectiveQuality, profile: QUALITY_PROFILES[effectiveQuality] });
  }

  public setDocumentHidden(hidden: boolean): void {
    if (hidden === this.currentState.documentHidden) return;
    this.setState({ ...this.currentState, documentHidden: hidden });
  }

  public reportFrame(frameDurationMs: number): void {
    if (!Number.isFinite(frameDurationMs) || frameDurationMs <= 0) return;
    this.frameSamples = [...this.frameSamples.slice(-59), frameDurationMs];
    const averageFrameMs = this.frameSamples.reduce((total, sample) => total + sample, 0) / this.frameSamples.length;
    const effectiveQuality = this.currentState.preferredQuality === "AUTO"
      ? this.qualityForFrameTime(averageFrameMs)
      : this.currentState.effectiveQuality;
    this.setState({ ...this.currentState, averageFrameMs, effectiveQuality, profile: QUALITY_PROFILES[effectiveQuality] });
  }

  public subscribe(listener: (state: PerformanceState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private qualityForFrameTime(frameMs: number): Exclude<QualityLevel, "AUTO"> {
    if (frameMs > 40) return "LOW";
    if (frameMs > 27) return "MEDIUM";
    return "HIGH";
  }

  private setState(state: PerformanceState): void {
    this.currentState = state;
    this.listeners.forEach((listener) => listener(this.currentState));
  }
}

export { QUALITY_PROFILES };
