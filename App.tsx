import React, { useState, useCallback } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { WORKER_BASE_URL } from './constants';
import LandingPage from './components/landing/LandingPage';
import RoomBookingSystem from './components/room/RoomBookingSystem';
import EquipmentSystem from './components/equipment/EquipmentSystem';
import Navbar from './components/layout/Navbar';
import { SystemType, ToastMessage } from './types';
import ToastContainer from './components/shared/ToastContainer';


const App: React.FC = () => {
  
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const newToast: ToastMessage = {
      id: Date.now() + Math.random(),
      message,
      type,
    };
    setToastMessages(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToastMessages(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const handleAdminLogin = async () => {
    if (isAdmin) {
      setIsAdmin(false);
      showToast('ออกจากโหมดเจ้าหน้าที่', 'success');
      return;
    }
    const password = prompt('กรุณาใส่รหัสผ่านเจ้าหน้าที่:');
    if (password) {
      try {
        const response = await fetch(`${WORKER_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setIsAdmin(true);
            showToast('เข้าสู่โหมดเจ้าหน้าที่สำเร็จ', 'success');
          } else {
            showToast('รหัสผ่านไม่ถูกต้อง', 'error');
          }
        } else {
          showToast('รหัสผ่านไม่ถูกต้อง', 'error');
        }
      } catch (error) {
        console.error('Admin login error:', error);
        showToast('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
      }
    }
  };






  return (
    <div className="app-container flex flex-col min-h-screen">
            <Navbar />
      <main className="main-content flex-1 p-4 md:p-8 w-full">
        <Routes>
          <Route path="/" element={<LandingPage onAdminLogin={handleAdminLogin} isAdmin={isAdmin} />} />
          <Route path="/room" element={<RoomBookingSystem showToast={showToast} isAdmin={isAdmin} />} />
          <Route path="/equipment" element={<EquipmentSystem showToast={showToast} isAdmin={isAdmin} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ToastContainer messages={toastMessages} onRemove={removeToast} />
    </div>
  );
};

export default App;