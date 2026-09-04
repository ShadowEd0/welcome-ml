import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OpeningSequence, MenuButton, NavigationMenu, UserPreferences } from './ui';
import { VisualCanvas } from './visual-engine/VisualCanvas';
import { UniverseRegistry } from './universes/UniverseRegistry';
import { Randomizer } from './universes/Randomizer';
import { CardViewer, FloatingCardsLayer } from './cards';
import { CardsProvider } from './cards/CardsContext';
import { EffectConfig } from './visual-engine/types';
import { UniverseConfig } from './universes/types';

const PREFS_STORAGE_KEY = 'welcome_ml_user_prefs';
const SEVEN_MINUTES_MS = 7 * 60 * 1000;

const DEFAULT_PREFERENCES: UserPreferences = {
  universeId: 'cosmos',
  intensity: 1.0,
  speed: 1.0,
  quality: 'AUTO',
  floatingCardsEnabled: true,
  floatingCardCount: 3,
};

function loadPreferences(): UserPreferences {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT_PREFERENCES;
    const saved = raw as Partial<UserPreferences>;
    return {
      universeId: typeof saved.universeId === 'string' ? saved.universeId : DEFAULT_PREFERENCES.universeId,
      intensity: typeof saved.intensity === 'number' && saved.intensity >= 0.2 && saved.intensity <= 2 ? saved.intensity : DEFAULT_PREFERENCES.intensity,
      speed: typeof saved.speed === 'number' && saved.speed >= 0.2 && saved.speed <= 2 ? saved.speed : DEFAULT_PREFERENCES.speed,
      quality: ['AUTO', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'].includes(saved.quality || '') ? saved.quality as UserPreferences['quality'] : DEFAULT_PREFERENCES.quality,
      floatingCardsEnabled: typeof saved.floatingCardsEnabled === 'boolean' ? saved.floatingCardsEnabled : DEFAULT_PREFERENCES.floatingCardsEnabled,
      floatingCardCount: typeof saved.floatingCardCount === 'number' ? Math.max(1, Math.min(3, Math.round(saved.floatingCardCount))) : DEFAULT_PREFERENCES.floatingCardCount,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export const App: React.FC = () => {
  const [showOpening, setShowOpening] = useState<boolean>(true);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const registry = UniverseRegistry.getInstance();
  const [randomizer] = useState(() => new Randomizer());

  const [universesList, setUniversesList] = useState<Array<{ id: string; name: string }>>([]);
  const [currentUniverse, setCurrentUniverse] = useState<UniverseConfig | null>(null);

  const [preferences, setPreferences] = useState<UserPreferences>(loadPreferences);

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
  const activeEffects: EffectConfig[] = (currentUniverse?.effects || []).map((eff) => {
    const extraParams = typeof eff.params === 'object' && eff.params !== null
      ? eff.params as Record<string, unknown>
      : {};
    return {
      ...extraParams,
      id: String(eff.id || eff.type),
      type: String(eff.type),
      enabled: eff.enabled ?? true,
      color: eff.color ?? [currentUniverse?.palette.primary ?? '#ffffff', currentUniverse?.palette.accent ?? '#ffffff'],
      speed: (typeof eff.speed === 'number' ? eff.speed : 1) * (currentUniverse?.speed ?? 1) * preferences.speed,
      count: Math.max(1, Math.round((typeof eff.count === 'number' ? eff.count : 50) * (currentUniverse?.density ?? 1) * preferences.intensity)),
    };
  });

  const background = currentUniverse?.background;
  const backgroundStyle = background
    ? background.type === 'radial'
      ? `radial-gradient(circle at ${background.glowPosition?.x ?? 50}% ${background.glowPosition?.y ?? 50}%, ${background.colors.join(', ')})`
      : `linear-gradient(${background.angle ?? 180}deg, ${background.colors.join(', ')})`
    : '#000000';
  const universeStyle = currentUniverse ? {
    '--u-primary': currentUniverse.palette.primary,
    '--u-secondary': currentUniverse.palette.secondary,
    '--u-accent': currentUniverse.palette.accent,
    '--u-text': currentUniverse.palette.textColor,
    '--u-glow': currentUniverse.palette.glowColor,
    background: backgroundStyle,
  } as React.CSSProperties : { background: backgroundStyle };

  return (
    <CardsProvider>
      <div style={{ width: '100vw', minHeight: '100dvh', height: '100vh', overflow: 'hidden', position: 'relative', ...universeStyle }}>
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
        <CardViewer />
      </div>
    </CardsProvider>
  );
};

export default App;
