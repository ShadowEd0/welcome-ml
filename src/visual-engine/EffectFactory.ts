import { IEffect, EffectConfig } from './types';
import { StarsEffect } from './effects/StarsEffect';
import { ShootingStarsEffect } from './effects/ShootingStarsEffect';
import { HeartsEffect } from './effects/HeartsEffect';
import { PetalsEffect } from './effects/PetalsEffect';
import { ButterfliesEffect } from './effects/ButterfliesEffect';
import { FirefliesEffect } from './effects/FirefliesEffect';
import { RainEffect } from './effects/RainEffect';
import { MistEffect } from './effects/MistEffect';
import { ParticlesEffect } from './effects/ParticlesEffect';
import { GlowEffect } from './effects/GlowEffect';

export type EffectConstructor = new (id?: string) => IEffect;

export class EffectFactory {
  private static registry: Map<string, EffectConstructor> = new Map([
    ['stars', StarsEffect],
    ['shooting_stars', ShootingStarsEffect],
    ['hearts', HeartsEffect],
    ['petals', PetalsEffect],
    ['butterflies', ButterfliesEffect],
    ['fireflies', FirefliesEffect],
    ['rain', RainEffect],
    ['mist', MistEffect],
    ['particles', ParticlesEffect],
    ['glow', GlowEffect],
  ]);

  public static registerEffect(type: string, constructor: EffectConstructor): void {
    this.registry.set(type, constructor);
  }

  public static createEffect(config: EffectConfig): IEffect | null {
    const Ctor = this.registry.get(config.type);
    if (!Ctor) {
      console.warn(`[VisualEngine] Unknown effect type: "${config.type}". Gracefully skipping.`);
      return null;
    }
    return new Ctor();
  }
}