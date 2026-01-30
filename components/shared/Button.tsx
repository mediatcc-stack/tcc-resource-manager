import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'nav' | 'stats';
  size?: 'sm' | 'md';
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', loading = false, className = '', ...props }) => {
  const baseClasses = 'font-semibold rounded-xl shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:transform-none';

  const sizeClasses = {
    md: 'px-6 py-3 text-sm',
    sm: 'px-4 py-2 text-xs',
  };

  const variantClasses = {
    primary: 'bg-blue-800 text-white hover:bg-blue-700 focus:ring-blue-500 hover:-translate-y-0.5 shadow-lg disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none',
    secondary: 'bg-white text-blue-800 border border-slate-300 hover:bg-slate-50 focus:ring-slate-400 focus:ring-offset-1 disabled:bg-gray-200 disabled:text-gray-400 disabled:border-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 hover:-translate-y-0.5 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none',
    nav: 'px-3 py-2 text-sm bg-blue-50 text-blue-800 hover:bg-blue-100 rounded-lg',
    stats: 'px-4 py-2 text-sm border-2 border-blue-800 bg-white text-blue-800 hover:bg-blue-50 font-bold rounded-xl',
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