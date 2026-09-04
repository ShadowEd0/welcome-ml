import React, { useState } from 'react';
import { SettingsPanel, UserPreferences } from '../settings/SettingsPanel';

type Tab = 'Experience' | 'Visuals' | 'Cards' | 'Customize';

interface NavigationMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onRandomize: () => void;
  preferences: UserPreferences;
  universes: Array<{ id: string; name: string }>;
  onUpdatePreferences: (updated: Partial<UserPreferences>) => void;
  onResetPreferences: () => void;
}

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

  if (!isOpen) return null;

  return (
    <div
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
        onClick={(e) => e.stopPropagation()}
        style={{
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
          {(['Experience', 'Visuals', 'Cards', 'Customize'] as Tab[]).map((tab) => (
            <button
              key={tab}
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
          {activeTab === 'Visuals' && (
            <div style={{ color: '#DDD', fontSize: '0.9rem' }}>
              <p>Configure procedural atmospheric lighting, halos, and particle layers in real-time.</p>
            </div>
          )}
          {activeTab === 'Cards' && (
            <div style={{ color: '#DDD', fontSize: '0.9rem' }}>
              <p>Explore floating 3D cards containing quotes and characters.</p>
            </div>
          )}
        </div>

        {/* Randomize Action Button */}
        <button
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