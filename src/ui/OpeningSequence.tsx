import React, { useEffect, useState } from 'react';

interface OpeningSequenceProps {
  onComplete: () => void;
}

export const OpeningSequence: React.FC<OpeningSequenceProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'text' | 'illumination' | 'fade-out' | 'done'>('text');

  useEffect(() => {
    // Phase 1: Text display & initial illumination (0s - 4s)
    const t1 = setTimeout(() => {
      setPhase('illumination');
    }, 3500);

    // Phase 2: Particle burst & universe visual formation (4s - 8s)
    const t2 = setTimeout(() => {
      setPhase('fade-out');
    }, 8000);

    // Phase 3: Final complete removal (approx 10s total)
    const t3 = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 10000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: phase === 'fade-out' ? 0 : 1,
        transition: 'opacity 2.2s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: phase === 'fade-out' ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          transform: phase === 'illumination' ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 4s ease-out, filter 3s ease-in-out',
          filter: phase === 'illumination' ? 'drop-shadow(0 0 25px rgba(255, 255, 255, 0.8))' : 'none',
        }}
      >
        <h1
          style={{
            fontFamily: '"Cinzel", "Playfair Display", Georgia, serif',
            fontSize: 'clamp(2.5rem, 8vw, 5.5rem)',
            fontWeight: 300,
            letterSpacing: '0.35em',
            color: '#FFFFFF',
            margin: 0,
            textTransform: 'UPPERCASE',
            opacity: phase === 'text' ? 0.9 : 1,
            animation: 'fadeInText 2.5s ease-forward',
          }}
        >
          WELCOME ML
        </h1>
        <div
          style={{
            marginTop: '1.5rem',
            height: '2px',
            width: phase === 'illumination' ? '180px' : '0px',
            background: 'linear-gradient(90deg, transparent, #FFFFFF, transparent)',
            marginInline: 'auto',
            transition: 'width 3s ease-in-out',
          }}
        />
      </div>
    </div>
  );
};