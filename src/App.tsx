import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { OpeningSequence, MenuButton, NavigationMenu, UserPreferences } from './ui';
import { VisualCanvas } from './visual-engine/VisualCanvas';
import { UniverseRegistry } from './universes/UniverseRegistry';
import { Randomizer } from './universes/Randomizer';
import { SceneTransitionManager } from './universes/SceneTransitionManager';
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
  const transitionManagerRef = useRef<SceneTransitionManager | null>(null);
  const isTransitioningRef = useRef(false);

  useEffect(() => {
    const allUniverses: UniverseConfig[] = registry.getAllUniverses();
    setUniversesList(allUniverses.map((u: UniverseConfig) => ({ id: u.id, name: u.name || u.id })));

    // Ne pas charger l'univers via le useEffect si une transition est en cours vers cet univers
    if (isTransitioningRef.current) return;

    const initialUni = registry.getUniverse(preferences.universeId) || allUniverses[0] || null;
    setCurrentUniverse(initialUni);
  }, [registry, preferences.universeId]);

  // Change l'univers avec une transition animée des couleurs CSS.
  // Le manager annule automatiquement toute transition précédente via RAF.
  const changeUniverseWithTransition = useCallback((toId: string) => {
    if (isTransitioningRef.current) return;

    const from = currentUniverse;
    const to = registry.getUniverse(toId);
    if (!from || !to || from.id === to.id) return;

    isTransitioningRef.current = true;

    // Mettre à jour les préférences immédiatement pour l'UI
    setPreferences(prev => ({ ...prev, universeId: toId }));

    const manager = new SceneTransitionManager();
    transitionManagerRef.current = manager;

    manager.startTransition(
      from,
      to,
      1.5,
      (config) => {
        // Pendant la transition : interpoler les couleurs CSS
        const root = document.documentElement;
        root.style.setProperty('--u-primary', config.palette.primary);
        root.style.setProperty('--u-secondary', config.palette.secondary);
        root.style.setProperty('--u-accent', config.palette.accent);
        root.style.setProperty('--u-text', config.palette.textColor);
        root.style.setProperty('--u-glow', config.palette.glowColor);
      },
      () => {
        // Fin de transition : charger le nouvel univers dans le VisualEngine
        setCurrentUniverse(to);
        isTransitioningRef.current = false;
        transitionManagerRef.current = null;
      }
    );
  }, [currentUniverse, registry]);

  const resetSevenMinuteTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      if (!currentUniverse) return;
      const nextUni = randomizer.getRandomUniverse(currentUniverse.id);
      if (nextUni) {
        setCurrentUniverse(nextUni);
        // Updater pur : la persistance est centralisée dans le useEffect
        // [preferences] (évite les écritures dupliquées sous StrictMode).
        setPreferences((prev: UserPreferences) => ({ ...prev, universeId: nextUni.id }));
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

  // Persistance centralisée des préférences : une seule écriture, tolérante
  // aux échecs (stockage désactivé/saturé), sans effet de bord dans les
  // updaters d'état.
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) {
      console.warn('localStorage inaccessible', e);
    }
  }, [preferences]);

  const handleUpdatePreferences = useCallback((updated: Partial<UserPreferences>) => {
    setPreferences((prev: UserPreferences) => ({ ...prev, ...updated }));

    if (updated.universeId) {
      changeUniverseWithTransition(updated.universeId);
      resetSevenMinuteTimer();
    }
  }, [changeUniverseWithTransition, resetSevenMinuteTimer]);

  const handleResetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);

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
      changeUniverseWithTransition(nextUni.id);
      resetSevenMinuteTimer();
    }
  }, [currentUniverse, randomizer, changeUniverseWithTransition, resetSevenMinuteTimer]);

  // Référence stable : évite que l'effet de timers d'OpeningSequence
  // (dépendant de onComplete) soit relancé à chaque render d'App.
  const handleOpeningComplete = useCallback(() => {
    setShowOpening(false);
  }, []);

  // Mémoïsé : évite de recréer le tableau (et donc de recharger tous les
  // effets du moteur via VisualCanvas) à chaque render sans rapport
  // (ouverture du menu, viewer de cartes…). Recréé uniquement quand
  // l'univers ou les multiplicateurs utilisateur changent réellement.
  const activeEffects = useMemo<EffectConfig[]>(() => {
    // Conversion vers EffectConfig[] (type du moteur visual-engine) :
    // applique les multiplicateurs d'intensité/vitesse/densité de l'univers
    // courant et des préférences utilisateur.
    return (currentUniverse?.effects || []).map((eff) => {
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
  }, [currentUniverse, preferences.speed, preferences.intensity]);

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
          <OpeningSequence onComplete={handleOpeningComplete} />
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
