
import React, { useState, useCallback } from 'react';
import LandingPage from './components/landing/LandingPage';
import RoomBookingSystem from './components/room/RoomBookingSystem';
import EquipmentSystem from './components/equipment/EquipmentSystem';
import { SystemType, ToastMessage } from './types';
import ToastContainer from './components/shared/ToastContainer';

const App: React.FC = () => {
  const [currentSystem, setCurrentSystem] = useState<SystemType>('landing');
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const newToast: ToastMessage = {
      id: Date.now(),
      message,
      type,
    };
    setToastMessages(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToastMessages(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const renderSystem = () => {
    switch (currentSystem) {
      case 'room':
        return <RoomBookingSystem onBackToLanding={goBackToLanding} showToast={showToast} />;
      case 'equipment':
        return <EquipmentSystem onBackToLanding={goBackToLanding} showToast={showToast} />;
      case 'landing':
      default:
        return <LandingPage onSelectSystem={setCurrentSystem} />;
    }
  };

  const goBackToLanding = () => {
    setCurrentSystem('landing');
  };

  return (
    <div className="app-container flex flex-col min-h-screen bg-gradient-to-br from-[#5071A4] to-[#9AACC8]">
      <main className="main-content flex-1 p-4 md:p-8 w-full">
        {renderSystem()}
      </main>
      <ToastContainer messages={toastMessages} onRemove={removeToast} />
    </div>
  );
};

export default App;
