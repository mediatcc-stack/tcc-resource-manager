
import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'nav' | 'stats';
  size?: 'sm' | 'md';
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', loading = false, className = '', ...props }) => {
  const baseClasses = 'font-semibold rounded-lg shadow-sm transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:transform-none';

  const sizeClasses = {
    md: 'px-5 py-2.5 text-sm',
    sm: 'px-3 py-1.5 text-xs',
  };

  const variantClasses = {
    primary: 'bg-[#0D448D] text-white hover:bg-[#043986] focus:ring-[#0D448D] hover:-translate-y-0.5',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-600 hover:-translate-y-0.5',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-600 hover:-translate-y-0.5',
    nav: 'px-3 py-2 text-sm bg-gray-200 text-gray-800 hover:bg-gray-300 rounded-md',
    stats: 'px-4 py-2 text-sm border-2 border-[#0D448D] bg-white text-[#0D448D] hover:bg-blue-50 font-semibold rounded-lg',
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