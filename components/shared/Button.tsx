import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'nav' | 'stats';
  size?: 'sm' | 'md';
  loading?: boolean;
}

// สีตาม TCC Brand Identity
const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)',
    color: 'white',
    border: 'none',
    boxShadow: '0 2px 8px rgba(13,68,141,0.25)',
  },
  secondary: {
    background: '#ffffff',
    color: 'var(--primary)',
    border: '1.5px solid #c7d9f5',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  danger: {
    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    color: 'white',
    border: 'none',
    boxShadow: '0 2px 8px rgba(220,38,38,0.25)',
  },
  nav: {
    background: 'var(--primary-light)',
    color: 'var(--primary)',
    border: '1px solid #bfdbfe',
    boxShadow: 'none',
  },
  stats: {
    background: 'white',
    color: 'var(--primary)',
    border: '1.5px solid var(--primary)',
    fontWeight: '700',
    boxShadow: 'none',
  },
};

const hoverStyles: Record<string, React.CSSProperties> = {
  primary: { background: 'linear-gradient(135deg, var(--primary-hover) 0%, var(--primary) 100%)', transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(13,68,141,0.35)' },
  secondary: { background: '#f0f6ff', transform: 'translateY(-1px)' },
  danger: { background: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)', transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(220,38,38,0.35)' },
  nav: { background: '#dbeafe' },
  stats: { background: 'var(--primary-light)' },
};

const sizeClasses: Record<string, string> = {
  md: 'px-5 py-2.5 text-sm',
  sm: 'px-4 py-2 text-xs',
};

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  ...props
}) => {
  const [hovered, setHovered] = React.useState(false);
  const disabled = props.disabled || loading;

  const baseStyle: React.CSSProperties = {
    fontWeight: 600,
    borderRadius: '12px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    outline: 'none',
    opacity: disabled ? 0.55 : 1,
    ...(disabled ? {} : (hovered ? hoverStyles[variant] : variantStyles[variant])),
    ...(!hovered ? variantStyles[variant] : {}),
    ...(hovered && !disabled ? hoverStyles[variant] : {}),
  };

  return (
    <button
      className={`${sizeClasses[size]} ${className}`}
      style={baseStyle}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
      disabled={disabled}
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2">
          <LoadingSpinner />
          <span>กำลังประมวลผล...</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;