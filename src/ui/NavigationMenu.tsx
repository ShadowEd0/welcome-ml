import React, { useEffect, useRef, useState } from 'react';
import { SettingsPanel, UserPreferences } from '../settings/SettingsPanel';
import { CardGallery } from '../cards';

type Tab = 'Experience' | 'Cards' | 'Customize';

interface NavigationMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onRandomize: () => void;
  preferences: UserPreferences;
  universes: Array<{ id: string; name: string }>;
  onUpdatePreferences: (updated: Partial<UserPreferences>) => void;
  onResetPreferences: () => void;
}

const CLOSE_ANIM_MS = 160;

export const NavigationMenu: React.FC<NavigationMenuProps> = ({
  isOpen,
  onClose,
  onRandomize,
  preferences,
  universes,
  onUpdatePreferences,
  onResetPreferences,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('Customize');
  const [mounted, setMounted] = useState(isOpen);
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Maintient le menu monté pendant la petite animation de fermeture.
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setClosing(false);
      return;
    }
    setClosing(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_ANIM_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Gestion du focus + Escape + piège de focus une fois le panneau rendu.
  useEffect(() => {
    if (!mounted || closing) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusables = () => {
      if (!panelRef.current) return [];
      return Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
    };

    const first = focusables()[0];
    first?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;

      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && (active === firstEl || !panelRef.current?.contains(active))) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && (active === lastEl || !panelRef.current?.contains(active))) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [mounted, closing, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`menu-overlay ${closing ? 'menu-overlay--closing' : ''}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onClick={(e) => e.stopPropagation()}
        className={`menu-panel ${closing ? 'menu-panel--closing' : ''}`}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '85vh',
          background: 'rgba(18, 18, 30, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '20px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(255, 255, 255, 0.06)',
            color: 'rgba(255, 255, 255, 0.75)',
            fontSize: '1.1rem',
            lineHeight: 1,
            cursor: 'pointer',
            zIndex: 1,
          }}
        >
          ×
        </button>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '0.8rem',
            marginBottom: '1.2rem',
            overflowX: 'auto',
          }}
        >
          {(['Experience', 'Cards', 'Customize'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                border: 'none',
                color: activeTab === tab ? '#FFF' : 'rgba(255, 255, 255, 0.6)',
                padding: '0.4rem 0.8rem',
                borderRadius: '12px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.2rem' }}>
          {activeTab === 'Customize' && (
            <SettingsPanel
              preferences={preferences}
              universes={universes}
              onChange={onUpdatePreferences}
              onReset={onResetPreferences}
            />
          )}
          {activeTab === 'Experience' && (
            <div style={{ color: '#DDD', fontSize: '0.9rem', lineHeight: 1.6 }}>
              <p>Welcome to <strong>WELCOME ML</strong> — a living, cinematic visual universe created with love.</p>
              <p>Let the scenes automatically evolve or manually steer your journey.</p>
            </div>
          )}
          {activeTab === 'Cards' && (
            <CardGallery onOpenCard={() => onClose()} />
          )}
        </div>

        {/* Randomize Action Button */}
        <button
          type="button"
          onClick={() => {
            onRandomize();
            onClose();
          }}
          style={{
            marginTop: '1.2rem',
            width: '100%',
            padding: '0.8rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.05))',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.95rem',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
          }}
        >
          ✦ Randomize
        </button>
      </div>
    </div>
  );
};
