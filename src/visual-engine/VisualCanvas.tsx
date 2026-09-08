import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { VisualEngine } from './VisualEngine';
import { EffectConfig, QualityLevel } from './types';

export interface VisualCanvasHandle {
  getEngine(): VisualEngine | null;
}

interface VisualCanvasProps {
  effects: EffectConfig[];
  quality?: QualityLevel;
  className?: string;
}

export const VisualCanvas = forwardRef<VisualCanvasHandle, VisualCanvasProps>(
  ({ effects, quality = 'AUTO', className = '' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const engineRef = useRef<VisualEngine | null>(null);

    // Dernière configuration reçue pendant une transition active. Écrasée à
    // chaque arrivée (dernière valeur gagne). La valeur « nulle » indique
    // qu'aucune config n'est en attente.
    const pendingEffectsRef = useRef<EffectConfig[] | null>(null);
    // ID du RAF qui observe la fin réelle de la transition (none = pas actif).
    const transitionWatchIdRef = useRef<number | null>(null);

    useImperativeHandle(ref, () => ({
      getEngine: () => engineRef.current,
    }), []);

    useEffect(() => {
      if (!canvasRef.current) return;

      const engine = new VisualEngine();
      engine.initialize(canvasRef.current, quality);
      engineRef.current = engine;

      return () => {
        if (transitionWatchIdRef.current !== null) {
          cancelAnimationFrame(transitionWatchIdRef.current);
          transitionWatchIdRef.current = null;
        }
        pendingEffectsRef.current = null;
        engine.destroy();
        engineRef.current = null;
      };
    }, []);

    useEffect(() => {
      if (engineRef.current) {
        engineRef.current.setQuality(quality);
      }
    }, [quality]);

    useEffect(() => {
      const engine = engineRef.current;
      if (!engine) return;

      // Pas de transition en cours : appliquer immédiatement (comportement
      // existant). C'est le cas courant (changement de speed/intensity
      // hors transition).
      if (!engine.isTransitioning()) {
        engine.loadUniverseConfig(effects);
        return;
      }

      // Une transition est active : la config est mémorisée en tant que
      // « dernière config à appliquer » (dernière valeur gagne par
      // écrasement). Un watcher RAF observe la fin réelle de la transition
      // (observée via engine.isTransitioning()) — aucun timer codé en dur,
      // aucune durée devinée.
      pendingEffectsRef.current = effects;

      if (transitionWatchIdRef.current !== null) return;

      const watch = (): void => {
        if (!engineRef.current) {
          transitionWatchIdRef.current = null;
          return;
        }
        if (!engineRef.current.isTransitioning()) {
          const pending = pendingEffectsRef.current;
          pendingEffectsRef.current = null;
          transitionWatchIdRef.current = null;
          if (pending && engineRef.current) {
            engineRef.current.loadUniverseConfig(pending);
          }
          return;
        }
        transitionWatchIdRef.current = requestAnimationFrame(watch);
      };
      transitionWatchIdRef.current = requestAnimationFrame(watch);
    }, [effects]);

    return (
      <canvas
        ref={canvasRef}
        className={className}
        style={{ position: 'fixed', inset: 0, zIndex: 0, touchAction: 'none' }}
      />
    );
  }
);
