import React from 'react';

export interface UserPreferences {
  universeId: string;
  intensity: number; // 0.1 - 2.0
  speed: number;     // 0.1 - 2.0
  quality: 'AUTO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
  floatingCardsEnabled: boolean;
  floatingCardCount: number; // 1 - 3
}

interface SettingsPanelProps {
  preferences: UserPreferences;
  universes: Array<{ id: string; name: string }>;
  onChange: (updated: Partial<UserPreferences>) => void;
  onReset: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  preferences,
  universes,
  onChange,
  onReset,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', color: '#E2E8F0' }}>
      {/* Universe Selection */}
      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', opacity: 0.8 }}>
          Universe
        </label>
        <select
          value={preferences.universeId}
          onChange={(e) => onChange({ universeId: e.target.value })}
          style={{
            width: '100%',
            padding: '0.6rem 0.8rem',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#FFF',
            outline: 'none',
          }}
        >
          {universes.map((u) => (
            <option key={u.id} value={u.id} style={{ background: '#12121E', color: '#FFF' }}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Intensity Control */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
          <span>Intensity</span>
          <span>{preferences.intensity.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="2.0"
          step="0.1"
          value={preferences.intensity}
          onChange={(e) => onChange({ intensity: parseFloat(e.target.value) })}
          style={{ width: '100%', accentColor: '#E2E8F0' }}
        />
      </div>

      {/* Speed Control */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
          <span>Animation Speed</span>
          <span>{preferences.speed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="2.0"
          step="0.1"
          value={preferences.speed}
          onChange={(e) => onChange({ speed: parseFloat(e.target.value) })}
          style={{ width: '100%', accentColor: '#E2E8F0' }}
        />
      </div>

      {/* Quality Level */}
      <div>
        <label style={{ display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem', opacity: 0.8 }}>
          Graphics Quality
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.3rem' }}>
          {(['AUTO', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA'] as const).map((q) => (
            <button
              key={q}
              onClick={() => onChange({ quality: q })}
              style={{
                padding: '0.4rem 0.2rem',
                fontSize: '0.7rem',
                borderRadius: '6px',
                border: preferences.quality === q ? '1px solid #FFF' : '1px solid rgba(255, 255, 255, 0.15)',
                background: preferences.quality === q ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)',
                color: '#FFF',
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Floating Cards Controls */}
      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <span style={{ fontSize: '0.85rem' }}>Floating Cards</span>
          <input
            type="checkbox"
            checked={preferences.floatingCardsEnabled}
            onChange={(e) => onChange({ floatingCardsEnabled: e.target.checked })}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
        </div>

        {preferences.floatingCardsEnabled && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem' }}>
              <span>Card Count</span>
              <span>{preferences.floatingCardCount}</span>
            </div>
            <input
              type="range"
              min="1"
              max="3"
              step="1"
              value={preferences.floatingCardCount}
              onChange={(e) => onChange({ floatingCardCount: parseInt(e.target.value, 10) })}
              style={{ width: '100%', accentColor: '#E2E8F0' }}
            />
          </div>
        )}
      </div>

      {/* Reset Action */}
      <button
        onClick={onReset}
        style={{
          marginTop: '0.5rem',
          padding: '0.6rem',
          borderRadius: '8px',
          background: 'transparent',
          border: '1px solid rgba(255, 100, 100, 0.4)',
          color: '#FFAAAA',
          cursor: 'pointer',
          fontSize: '0.8rem',
          transition: 'background 0.2s',
        }}
      >
        Reset Defaults
      </button>
    </div>
  );
};