import type { KeyValueStorage, PersistenceService } from "../core/contracts";

const memoryStorage = new Map<string, string>();

function browserStorage(): KeyValueStorage | undefined {
  try {
    if (typeof window === "undefined" || !window.localStorage) return undefined;
    const probe = "__welcome_ml_storage_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export interface SafePersistenceOptions {
  namespace?: string;
  storage?: KeyValueStorage;
}

/**
 * JSON persistence that never throws when browser storage is disabled, full, or
 * corrupted. An in-memory fallback still works for the active page session.
 */
export function createSafePersistence(options: SafePersistenceOptions = {}): PersistenceService {
  const namespace = options.namespace ?? "welcome-ml";
  const primaryStorage = options.storage ?? browserStorage();
  const keyFor = (key: string) => `${namespace}:${key}`;

  const safely = <T>(operation: () => T, fallback: T): T => {
    try { return operation(); } catch { return fallback; }
  };

  return {
    isAvailable: () => Boolean(primaryStorage),
    save: <T>(key: string, value: T): boolean => {
      const serialized = safely(() => JSON.stringify(value), undefined);
      if (serialized === undefined) return false;
      const storageKey = keyFor(key);
      const saved = primaryStorage ? safely(() => { primaryStorage.setItem(storageKey, serialized); return true; }, false) : false;
      if (!saved) memoryStorage.set(storageKey, serialized);
      return true;
    },
    load: <T>(key: string, fallback: T): T => {
      const storageKey = keyFor(key);
      const serialized = primaryStorage
        ? safely(() => primaryStorage.getItem(storageKey), null) ?? memoryStorage.get(storageKey) ?? null
        : memoryStorage.get(storageKey) ?? null;
      if (serialized === null) return fallback;
      return safely(() => JSON.parse(serialized) as T, fallback);
    },
    reset: (key: string): boolean => {
      const storageKey = keyFor(key);
      const removed = primaryStorage ? safely(() => { primaryStorage.removeItem(storageKey); return true; }, false) : false;
      memoryStorage.delete(storageKey);
      return removed || !primaryStorage;
    },
  };
}
