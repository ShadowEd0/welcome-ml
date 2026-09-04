import { UniverseConfig } from './types';
import { UniverseRegistry } from './UniverseRegistry';

export class Randomizer {
  private history: string[] = [];
  private historyLimit = 3;

  public getRandomUniverse(currentId: string): UniverseConfig {
    const registry = UniverseRegistry.getInstance();
    const all = registry.getAllUniverses();

    if (all.length === 0) {
      return registry.getUniverse('cosmos');
    }

    if (all.length === 1) {
      return all[0];
    }

    const currentConfig = registry.getUniverse(currentId);
    const compatibleList = currentConfig.compatibleWith || [];

    const candidates = all.filter((u) => {
      if (u.id === currentId) return false;
      if (this.history.includes(u.id) && all.length > this.historyLimit + 1) return false;
      return true;
    });

    const weightedCandidates = candidates.map((u) => ({
      universe: u,
      weight: compatibleList.includes(u.id) ? 2.5 : 1.0,
    }));

    const totalWeight = weightedCandidates.reduce((acc, item) => acc + item.weight, 0);
    let randomVal = Math.random() * totalWeight;

    let selected = candidates[0] || all[0];
    for (const item of weightedCandidates) {
      if (randomVal <= item.weight) {
        selected = item.universe;
        break;
      }
      randomVal -= item.weight;
    }

    this.recordHistory(selected.id);
    return selected;
  }

  private recordHistory(id: string): void {
    this.history.push(id);
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }

  public resetHistory(): void {
    this.history = [];
  }
}