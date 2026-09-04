import { UniverseConfig } from './types';
import { validateUniverseConfig } from './schema';

import cosmosJson from '../../data/universes/cosmos.json';
import sakuraJson from '../../data/universes/sakura.json';
import loveJson from '../../data/universes/love.json';
import enchantedJson from '../../data/universes/enchanted.json';
import rainJson from '../../data/universes/rain.json';
import sunsetJson from '../../data/universes/sunset.json';
import oceanJson from '../../data/universes/ocean.json';
import fantasyJson from '../../data/universes/fantasy.json';
import dreamJson from '../../data/universes/dream.json';

export class UniverseRegistry {
  private static instance: UniverseRegistry;
  private universes: Map<string, UniverseConfig> = new Map();
  private fallbackUniverseId = 'cosmos';

  private constructor() {
    this.registerInitialUniverses();
  }

  public static getInstance(): UniverseRegistry {
    if (!UniverseRegistry.instance) {
      UniverseRegistry.instance = new UniverseRegistry();
    }
    return UniverseRegistry.instance;
  }

  private registerInitialUniverses(): void {
    const rawUniverses = [
      dreamJson,
      cosmosJson,
      sakuraJson,
      loveJson,
      enchantedJson,
      rainJson,
      sunsetJson,
      oceanJson,
      fantasyJson,
    ];

    for (const raw of rawUniverses) {
      this.registerUniverse(raw);
    }
  }

  public registerUniverse(rawConfig: unknown): boolean {
    const validation = validateUniverseConfig(rawConfig);
    if (!validation.valid || !validation.config) {
      console.warn('[UniverseRegistry] Failed to register universe:', validation.errors);
      return false;
    }

    this.universes.set(validation.config.id, validation.config);
    return true;
  }

  public getUniverse(id: string): UniverseConfig {
    const config = this.universes.get(id);
    if (!config) {
      console.warn(`[UniverseRegistry] Universe "${id}" not found. Falling back to "${this.fallbackUniverseId}".`);
      return this.universes.get(this.fallbackUniverseId)!;
    }
    return config;
  }

  public getAllUniverses(): UniverseConfig[] {
    return Array.from(this.universes.values());
  }

  public getAllIds(): string[] {
    return Array.from(this.universes.keys());
  }
}