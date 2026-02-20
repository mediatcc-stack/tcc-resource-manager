import React, { useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './components/landing/LandingPage';
import RoomBookingSystem from './components/room/RoomBookingSystem';
import EquipmentSystem from './components/equipment/EquipmentSystem';
import Navbar from './components/layout/Navbar';
import { SystemType, ToastMessage } from './types';
import ToastContainer from './components/shared/ToastContainer';
import { STAFF_PASSWORDS } from './constants';

const App: React.FC = () => {
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  const handleSelectSystem = (system: SystemType) => {
    if (system === 'room') navigate('/room');
    else if (system === 'equipment') navigate('/equipment');
  };

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




  return (
    <div className="app-container flex flex-col min-h-screen bg-slate-50 text-slate-800">
      <Navbar />
      <main className="main-content flex-1 p-4 md:p-8 w-full">
        <Routes>
          <Route path="/room" element={<RoomBookingSystem showToast={showToast} isAdmin={isAdmin} />} />
          <Route path="/equipment" element={<EquipmentSystem showToast={showToast} isAdmin={isAdmin} />} />
          <Route path="/" element={<LandingPage onSelectSystem={handleSelectSystem} onAdminLogin={handleAdminLogin} isAdmin={isAdmin} />} />
        </Routes>
      </main>
      <ToastContainer messages={toastMessages} onRemove={removeToast} />
    </div>
  );
};

export default App;