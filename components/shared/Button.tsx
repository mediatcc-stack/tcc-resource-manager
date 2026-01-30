import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'nav' | 'stats';
  size?: 'sm' | 'md';
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', loading = false, className = '', ...props }) => {
  const baseClasses = 'font-semibold rounded-xl shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none';

  const sizeClasses = {
    md: 'px-6 py-3 text-sm',
    sm: 'px-4 py-2 text-xs',
  };

  const variantClasses = {
    primary: 'bg-[#0D448D] text-white hover:bg-blue-900 focus:ring-blue-500 hover:-translate-y-0.5 shadow-lg',
    secondary: 'bg-gray-500 text-white hover:bg-gray-600 focus:ring-gray-500 hover:-translate-y-0.5',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 focus:ring-rose-500 hover:-translate-y-0.5',
    nav: 'px-3 py-2 text-sm bg-blue-50 text-[#0D448D] hover:bg-blue-100 rounded-lg',
    stats: 'px-4 py-2 text-sm border-2 border-[#0D448D] bg-white text-[#0D448D] hover:bg-blue-50 font-bold rounded-xl',
  };

  const disabled = props.disabled || loading;

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
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