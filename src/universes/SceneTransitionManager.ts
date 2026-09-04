import { UniverseConfig, TransitionState } from './types';

export class SceneTransitionManager {
  private transitionState: TransitionState = {
    isTransitioning: false,
    progress: 0,
    fromUniverse: null,
    toUniverse: null,
    currentEvolvedConfig: null,
  };

  private animationFrameId: number | null = null;
  private duration = 2.0; // seconds

  public startTransition(
    from: UniverseConfig,
    to: UniverseConfig,
    durationInSeconds = 2.0,
    onUpdate?: (evolvedConfig: UniverseConfig, progress: number) => void,
    onComplete?: () => void
  ): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.duration = durationInSeconds;
    this.transitionState = {
      isTransitioning: true,
      progress: 0,
      fromUniverse: from,
      toUniverse: to,
      currentEvolvedConfig: from,
    };

    let startTime: number | null = null;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const rawProgress = Math.min(elapsed / this.duration, 1.0);
      const easedProgress = this.easeInOutCubic(rawProgress);

      const evolved = this.interpolateUniverse(from, to, easedProgress);
      this.transitionState.progress = easedProgress;
      this.transitionState.currentEvolvedConfig = evolved;

      if (onUpdate) onUpdate(evolved, easedProgress);

      if (rawProgress < 1.0) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.transitionState.isTransitioning = false;
        this.animationFrameId = null;
        if (onComplete) onComplete();
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  private interpolateUniverse(from: UniverseConfig, to: UniverseConfig, t: number): UniverseConfig {
    return {
      ...to,
      palette: {
        ...to.palette,
        primary: this.interpolateColor(from.palette.primary, to.palette.primary, t),
        secondary: this.interpolateColor(from.palette.secondary, to.palette.secondary, t),
        accent: this.interpolateColor(from.palette.accent, to.palette.accent, t),
        glowColor: this.interpolateColor(from.palette.glowColor, to.palette.glowColor, t),
        textColor: this.interpolateColor(from.palette.textColor, to.palette.textColor, t),
        cardBorderColor: this.interpolateColor(from.palette.cardBorderColor, to.palette.cardBorderColor, t),
        backgroundGradient: to.palette.backgroundGradient.map((color, i) =>
          this.interpolateColor(from.palette.backgroundGradient[i] || from.palette.backgroundGradient[0], color, t)
        ),
      },
      atmosphere: {
        blurLevel: from.atmosphere.blurLevel + (to.atmosphere.blurLevel - from.atmosphere.blurLevel) * t,
        opacity: from.atmosphere.opacity + (to.atmosphere.opacity - from.atmosphere.opacity) * t,
        ambientLight: this.interpolateColor(from.atmosphere.ambientLight, to.atmosphere.ambientLight, t),
      },
      intensity: (from.intensity ?? 1) + ((to.intensity ?? 1) - (from.intensity ?? 1)) * t,
      speed: (from.speed ?? 1) + ((to.speed ?? 1) - (from.speed ?? 1)) * t,
      density: (from.density ?? 1) + ((to.density ?? 1) - (from.density ?? 1)) * t,
    };
  }

  private interpolateColor(colorA: string, colorB: string, t: number): string {
    const rgbA = this.parseColor(colorA);
    const rgbB = this.parseColor(colorB);

    const r = Math.round(rgbA.r + (rgbB.r - rgbA.r) * t);
    const g = Math.round(rgbA.g + (rgbB.g - rgbA.g) * t);
    const b = Math.round(rgbA.b + (rgbB.b - rgbA.b) * t);
    const a = rgbA.a + (rgbB.a - rgbA.a) * t;

    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
  }

  private parseColor(colorStr: string): { r: number; g: number; b: number; a: number } {
    if (colorStr.startsWith('#')) {
      let hex = colorStr.slice(1);
      if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const num = parseInt(hex, 16);
      return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255, a: 1.0 };
    }

    if (colorStr.startsWith('rgba') || colorStr.startsWith('rgb')) {
      const match = colorStr.match(/[\d.]+/g);
      if (match && match.length >= 3) {
        return {
          r: parseFloat(match[0]),
          g: parseFloat(match[1]),
          b: parseFloat(match[2]),
          a: match[3] !== undefined ? parseFloat(match[3]) : 1.0,
        };
      }
    }

    return { r: 255, g: 255, b: 255, a: 1.0 };
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  public getTransitionState(): TransitionState {
    return { ...this.transitionState };
  }
}