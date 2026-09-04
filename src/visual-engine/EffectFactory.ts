import { BaseEffect } from './BaseEffect';
import { StarsEffect } from './effects/StarsEffect';
import { ShootingStarsEffect } from './effects/ShootingStarsEffect';
import { HeartsEffect } from './effects/HeartsEffect';
import { PetalsEffect } from './effects/PetalsEffect';
import { GlowEffect } from './effects/GlowEffect';
import { ButterfliesEffect } from './effects/ButterfliesEffect';
import { FirefliesEffect } from './effects/FirefliesEffect';
import { MistEffect } from './effects/MistEffect';
import { ParticlesEffect } from './effects/ParticlesEffect';
import { RainEffect } from './effects/RainEffect';
import { EffectConfig } from './types';

export type EffectConstructor = new (id?: string) => BaseEffect<unknown>;

export class EffectFactory {
  private static registry: Map<string, EffectConstructor> = new Map<string, EffectConstructor>([
    ['stars', StarsEffect as unknown as EffectConstructor],
    ['shooting-stars', ShootingStarsEffect as unknown as EffectConstructor],
    ['shooting_stars', ShootingStarsEffect as unknown as EffectConstructor],
    ['hearts', HeartsEffect as unknown as EffectConstructor],
    ['petals', PetalsEffect as unknown as EffectConstructor],
    ['glow', GlowEffect as unknown as EffectConstructor],
    ['butterflies', ButterfliesEffect as unknown as EffectConstructor],
    ['fireflies', FirefliesEffect as unknown as EffectConstructor],
    ['mist', MistEffect as unknown as EffectConstructor],
    ['particles', ParticlesEffect as unknown as EffectConstructor],
    ['rain', RainEffect as unknown as EffectConstructor],
  ]);

  public static create(type: string, id?: string): BaseEffect<unknown> | null {
    const Ctor = this.registry.get(type);
    if (!Ctor) {
      console.warn(`[EffectFactory] Type d'effet inconnu : ${type}`);
      return null;
    }
    return new Ctor(id);
  }

  public static createEffect(config: EffectConfig): BaseEffect<unknown> | null {
    return this.create(config.type, config.id);
  }

  public static register(type: string, constructor: EffectConstructor): void {
    this.registry.set(type, constructor);
  }

  public static has(type: string): boolean {
    return this.registry.has(type);
  }

  public static getRegisteredTypes(): string[] {
    return Array.from(this.registry.keys());
  }
}
