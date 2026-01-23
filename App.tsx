import React, { useState, useCallback } from 'react';
import LandingPage from './components/landing/LandingPage';
import RoomBookingSystem from './components/room/RoomBookingSystem';
import EquipmentSystem from './components/equipment/EquipmentSystem';
import Navbar from './components/layout/Navbar';
import { SystemType, ToastMessage } from './types';
import ToastContainer from './components/shared/ToastContainer';
import { STAFF_PASSWORDS } from './constants';

const App: React.FC = () => {
  const [currentSystem, setCurrentSystem] = useState<SystemType>('landing');
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

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

  const handleAdminLogin = () => {
    if (isAdmin) {
      setIsAdmin(false);
      showToast('ออกจากโหมดเจ้าหน้าที่', 'success');
      return;
    }
    const password = prompt('กรุณาใส่รหัสผ่านเจ้าหน้าที่:');
    if (password && STAFF_PASSWORDS.includes(password)) {
        setIsAdmin(true);
        showToast('เข้าสู่โหมดเจ้าหน้าที่สำเร็จ', 'success');
    } else if (password) {
        showToast('รหัสผ่านไม่ถูกต้อง', 'error');
    }
  };


  const goBackToLanding = () => {
    setCurrentSystem('landing');
  };

  const renderSystem = () => {
    switch (currentSystem) {
      case 'room':
        return <RoomBookingSystem onBackToLanding={goBackToLanding} showToast={showToast} isAdmin={isAdmin} />;
      case 'equipment':
        return <EquipmentSystem onBackToLanding={goBackToLanding} showToast={showToast} isAdmin={isAdmin} />;
      case 'landing':
      default:
        return <LandingPage onSelectSystem={setCurrentSystem} onAdminLogin={handleAdminLogin} isAdmin={isAdmin} />;
    }
  };

  return (
    <div className="app-container flex flex-col min-h-screen">
      <Navbar currentSystem={currentSystem} onBackToLanding={goBackToLanding} />
      <main className="main-content flex-1 p-4 md:p-8 w-full">
        {renderSystem()}
      </main>
      <ToastContainer messages={toastMessages} onRemove={removeToast} />
    </div>
  );
};

export default App;