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
// src/visual-engine/EffectFactory.ts — ajouter les nouveaux effets au registre
import { HeartFormationEffect } from './effects/HeartFormationEffect';
import { ConstellationEffect } from './effects/ConstellationEffect';
import { AuroraEffect } from './effects/AuroraEffect';

export type EffectConstructor = new (id?: string) => BaseEffect<any>;

export class EffectFactory {
  private static registry: Map<string, EffectConstructor> = new Map<string, EffectConstructor>([
    ['stars', StarsEffect as unknown as EffectConstructor],
    ['shooting-stars', ShootingStarsEffect as unknown as EffectConstructor],
    ['hearts', HeartsEffect as unknown as EffectConstructor],
    ['petals', PetalsEffect as unknown as EffectConstructor],
    ['glow', GlowEffect as unknown as EffectConstructor],
    ['butterflies', ButterfliesEffect as unknown as EffectConstructor],
    ['fireflies', FirefliesEffect as unknown as EffectConstructor],
    ['mist', MistEffect as unknown as EffectConstructor],
    ['particles', ParticlesEffect as unknown as EffectConstructor],
    ['rain', RainEffect as unknown as EffectConstructor],
    // ... entrées existantes ...
    ['heart_formation', HeartFormationEffect as unknown as EffectConstructor],
    ['constellation', ConstellationEffect as unknown as EffectConstructor],
    ['aurora', AuroraEffect as unknown as EffectConstructor],
  ]);

  public static create(type: string, id?: string): BaseEffect<any> | null {
    const Ctor = this.registry.get(type);
    if (!Ctor) {
      console.warn(`[EffectFactory] Type d'effet inconnu : ${type}`);
      return null;
    }
    return new Ctor(id);
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