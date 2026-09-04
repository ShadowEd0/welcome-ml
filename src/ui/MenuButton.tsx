import React from 'react';

interface MenuButtonProps {
  isOpen: boolean;
  onClick: () => void;
  accentColor?: string;
}

export const MenuButton: React.FC<MenuButtonProps> = ({ isOpen, onClick, accentColor = 'rgba(255, 255, 255, 0.8)' }) => {
  return (
    <button
      onClick={onClick}
      aria-label="Toggle Navigation Menu"
      style={{
        position: 'fixed',
        top: '1.5rem',
        left: '1.5rem',
        zIndex: 1000,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(15, 15, 25, 0.45)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${accentColor}`,
        boxShadow: `0 0 15px ${accentColor}`,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        outline: 'none',
      }}
    >
      <div
        style={{
          width: '18px',
          height: '14px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            width: '100%',
            height: '2px',
            backgroundColor: '#FFF',
            borderRadius: '2px',
            transform: isOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none',
            transition: 'transform 0.3s ease',
          }}
        />
        <span
          style={{
            width: '100%',
            height: '2px',
            backgroundColor: '#FFF',
            borderRadius: '2px',
            opacity: isOpen ? 0 : 1,
            transition: 'opacity 0.2s ease',
          }}
        />
        <span
          style={{
            width: '100%',
            height: '2px',
            backgroundColor: '#FFF',
            borderRadius: '2px',
            transform: isOpen ? 'rotate(-45deg) translate(4px, -4px)' : 'none',
            transition: 'transform 0.3s ease',
          }}
        />
      </div>
    </button>
  );
};