import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OpeningSequence, MenuButton, NavigationMenu, UserPreferences } from './ui';
import { VisualCanvas } from './visual-engine/VisualCanvas';
import { UniverseRegistry } from './universes/UniverseRegistry';
import { Randomizer } from './universes/Randomizer';
import { FloatingCardsLayer } from './cards/FloatingCardsLayer';
import { CardsProvider } from './cards/CardsContext';
import { UniverseConfig } from './universes/types';
import type { EffectConfig } from './visual-engine/types';
import { paletteFromUniverse } from './visual-engine/palette';
// ❌ supprimer : import { VisualEffectConfig } from './core/contracts';


const PREFS_STORAGE_KEY = 'welcome_ml_user_prefs';
const SEVEN_MINUTES_MS = 7 * 60 * 1000;
const derivedPalette = paletteFromUniverse(currentUniverse?.palette);

// ✅ on conserve TOUT ce que le JSON déclare (color, count, size, opacity...)
// et on n'ajoute que ce qui manquait : la palette de l'univers + les multiplicateurs utilisateur.
const derivedPalette = paletteFromUniverse(currentUniverse?.palette);
const activeEffects: EffectConfig[] = (currentUniverse?.effects || []).map((eff) => ({
  ...eff,
   speed: (eff.speed ?? 1) * preferences.speed,
   count: eff.count !== undefined
     ? Math.max(1, Math.round(eff.count * preferences.intensity))
     : eff.count,
   palette: derivedPalette,
 }));
const DEFAULT_PREFERENCES: UserPreferences = {
  universeId: 'cosmos',
  intensity: 1.0,
  speed: 1.0,
  quality: 'AUTO',
  floatingCardsEnabled: true,
  floatingCardCount: 3,
};

export const App: React.FC = () => {
  const [showOpening, setShowOpening] = useState<boolean>(true);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const registry = UniverseRegistry.getInstance();
  const [randomizer] = useState(() => new Randomizer());

  const [universesList, setUniversesList] = useState<Array<{ id: string; name: string }>>([]);
  const [currentUniverse, setCurrentUniverse] = useState<UniverseConfig | null>(null);

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    try {
      const saved = localStorage.getItem(PREFS_STORAGE_KEY);
      return saved ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const allUniverses: UniverseConfig[] = registry.getAllUniverses();
    setUniversesList(allUniverses.map((u: UniverseConfig) => ({ id: u.id, name: u.name || u.id })));

    const initialUni = registry.getUniverse(preferences.universeId) || allUniverses[0] || null;
    setCurrentUniverse(initialUni);
  }, [registry, preferences.universeId]);

  const resetSevenMinuteTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      if (!currentUniverse) return;
      const nextUni = randomizer.getRandomUniverse(currentUniverse.id);
      if (nextUni) {
        setCurrentUniverse(nextUni);
        setPreferences((prev: UserPreferences) => {
          const updated = { ...prev, universeId: nextUni.id };
          try {
            localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
          } catch (e) {
            console.warn('localStorage inaccessible', e);
          }
          return updated;
        });
      }
    }, SEVEN_MINUTES_MS);
  }, [currentUniverse, randomizer]);

  useEffect(() => {
    resetSevenMinuteTimer();
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [resetSevenMinuteTimer]);

  const handleUpdatePreferences = useCallback((updated: Partial<UserPreferences>) => {
    setPreferences((prev: UserPreferences) => {
      const next = { ...prev, ...updated };
      try {
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('localStorage inaccessible', e);
      }
      return next;
    });

    if (updated.universeId) {
      const selected = registry.getUniverse(updated.universeId);
      if (selected) {
        setCurrentUniverse(selected);
        resetSevenMinuteTimer();
      }
    }
  }, [registry, resetSevenMinuteTimer]);

  const handleResetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
    } catch (e) {
      console.warn('localStorage inaccessible', e);
    }

    const defaultUni = registry.getUniverse(DEFAULT_PREFERENCES.universeId);
    if (defaultUni) {
      setCurrentUniverse(defaultUni);
      resetSevenMinuteTimer();
    }
  }, [registry, resetSevenMinuteTimer]);

  const handleRandomize = useCallback(() => {
    if (!currentUniverse) return;
    const nextUni = randomizer.getRandomUniverse(currentUniverse.id);
    if (nextUni) {
      handleUpdatePreferences({ universeId: nextUni.id });
    }
  }, [currentUniverse, randomizer, handleUpdatePreferences]);

  // Conversion explicite vers VisualEffectConfig[] (type réel de core/contracts)
  const activeEffects: VisualEffectConfig[] = (currentUniverse?.effects || []).map((eff) => ({
    id: String(eff.id || eff.type),
    type: String(eff.type),
    enabled: eff.enabled ?? true,
    params: {
      ...(eff.params || {}),
      speedMultiplier: preferences.speed,
      densityMultiplier: preferences.intensity,
    },
  }));

  return (
    <CardsProvider>
      <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', backgroundColor: '#000000' }}>
        {showOpening && (
          <OpeningSequence onComplete={() => setShowOpening(false)} />
        )}

        <VisualCanvas
          effects={activeEffects}
          quality={preferences.quality}
        />

        {preferences.floatingCardsEnabled && !showOpening && (
          <FloatingCardsLayer
            count={preferences.floatingCardCount}
            enabled={preferences.floatingCardsEnabled}
            reducedMotion={false}
          />
        )}

        {!showOpening && (
          <>
            <MenuButton
              isOpen={isMenuOpen}
              onClick={() => setIsMenuOpen((prev: boolean) => !prev)}
            />
            <NavigationMenu
              isOpen={isMenuOpen}
              onClose={() => setIsMenuOpen(false)}
              onRandomize={handleRandomize}
              preferences={preferences}
              universes={universesList}
              onUpdatePreferences={handleUpdatePreferences}
              onResetPreferences={handleResetPreferences}
            />
          </>
        )}
      </div>
    </CardsProvider>
  );
};

export default App;