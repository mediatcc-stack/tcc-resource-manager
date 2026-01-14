
import React, { useEffect, useState } from 'react';
import { ToastMessage } from '../../types';

interface ToastProps {
  toast: ToastMessage;
  onRemove: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onRemove }) => {
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleRemove();
    }, 4000); // Auto remove after 4 seconds

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const handleRemove = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300); // Match fade-out duration
  };
  
  const baseClasses = "flex items-center w-full max-w-xs p-4 my-2 text-gray-500 bg-white rounded-lg shadow-lg transition-all duration-300";
  const typeClasses = {
    success: 'text-green-800 bg-green-50',
    error: 'text-red-800 bg-red-50',
  };
  const iconClasses = {
      success: '✅',
      error: '❌'
  }

  return (
    <div 
        className={`${baseClasses} ${typeClasses[toast.type]} ${isFadingOut ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
        role="alert"
    >
      <div className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg`}>
        {iconClasses[toast.type]}
      </div>
      <div className="ml-3 text-sm font-semibold">{toast.message}</div>
      <button 
        type="button" 
        className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex h-8 w-8" 
        onClick={handleRemove} 
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
      </button>
    </div>
  );
};

export default Toast;
