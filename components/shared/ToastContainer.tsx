
import React from 'react';
import { ToastMessage } from '../../types';
import Toast from './Toast';

interface ToastContainerProps {
  messages: ToastMessage[];
  onRemove: (id: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ messages, onRemove }) => {
  return (
    <div className="fixed top-5 right-5 z-50">
      {messages.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

export default ToastContainer;
