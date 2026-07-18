import React, { useEffect, useState } from 'react';
import { ToastMessage } from '../../types';

interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: number) => void;
}

const typeConfig = {
  success: {
    bg: '#f0fdf4',
    border: '#86efac',
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    textColor: '#15803d',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  error: {
    bg: '#fff1f2',
    border: '#fca5a5',
    iconBg: '#fee2e2',
    iconColor: '#dc2626',
    textColor: '#b91c1c',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
  },
};

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const config = typeConfig[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => handleRemove(), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handleRemove = () => {
    setIsFadingOut(true);
    setTimeout(() => onRemove(toast.id), 350);
  };

  return (
    <div
      role="alert"
      className={isFadingOut ? '' : 'animate-slide-in-right'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '14px',
        background: config.bg,
        border: `1.5px solid ${config.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
        minWidth: '280px',
        maxWidth: '360px',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'translateX(60px)' : 'translateX(0)',
        cursor: 'default',
      }}
    >
      {/* ไอคอน */}
      <div
        style={{
          flexShrink: 0,
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: config.iconBg,
          color: config.iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {config.icon}
      </div>

      {/* ข้อความ */}
      <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: config.textColor, lineHeight: '1.4' }}>
        {toast.message}
      </div>

      {/* ปุ่มปิด */}
      <button
        type="button"
        onClick={handleRemove}
        aria-label="ปิด"
        style={{
          flexShrink: 0,
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: 'transparent',
          border: 'none',
          color: config.iconColor,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.6,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
};

export default Toast;