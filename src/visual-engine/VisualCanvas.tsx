import React, { useEffect, useRef } from 'react';
import { VisualEngine } from './VisualEngine';
import { EffectConfig, QualityLevel } from './types';

interface VisualCanvasProps {
  effects: EffectConfig[];
  quality?: QualityLevel;
  className?: string;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({ effects, quality = 'AUTO', className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<VisualEngine | null>(null);

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
      className={`fixed inset-0 pointer-events-auto z-0 ${className}`}
      style={{ touchAction: 'none' }}
    />
  );
};