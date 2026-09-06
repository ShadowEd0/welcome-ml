import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
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

    useImperativeHandle(ref, () => ({
      getEngine: () => engineRef.current,
    }), []);

    useEffect(() => {
      if (!canvasRef.current) return;

      const engine = new VisualEngine();
      engine.initialize(canvasRef.current, quality);
      engineRef.current = engine;

      return () => {
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
      if (engineRef.current) {
        engineRef.current.loadUniverseConfig(effects);
      }
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
