import React, { useState } from 'react';
import { SystemType } from '../../types';
import SystemCard from './SystemCard';
import { APP_CONFIG } from '../../constants';
import { fetchWorkerStatus, WorkerStatus } from '../../services/apiService';
import ConfigurationStatusModal from '../admin/ConfigurationStatusModal';
import LoadingSpinner from '../shared/LoadingSpinner';

interface LandingPageProps {
  onSelectSystem: (system: SystemType) => void;
  onAdminLogin: () => void;
  isAdmin: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectSystem, onAdminLogin, isAdmin }) => {
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const handleCheckStatus = async () => {
    setIsCheckingStatus(true);
    setStatusError(null);
    setWorkerStatus(null);
    try {
      const status = await fetchWorkerStatus();
      setWorkerStatus(status);
    } catch (error: any) {
      setStatusError(error.message || 'ไม่สามารถเชื่อมต่อกับ Worker ได้');
    } finally {
      setIsCheckingStatus(false);
      setIsStatusModalOpen(true);
    }
  };
  
  return (
    <>
      <ConfigurationStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        status={workerStatus}
        error={statusError}
      />
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-5 text-center animate-fade-in">
        <h1 className="text-4xl md:text-6xl font-black mb-4 text-[#0D448D] tracking-tight text-shadow-md">
          ระบบจองห้องและยืมอุปกรณ์
        </h1>
        <p className="text-xl md:text-2xl text-slate-600 font-medium mb-10">
          {APP_CONFIG.collegeName}
        </p>
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <SystemCard
            icon="📷"
            title={APP_CONFIG.equipmentTitle}
            description="จัดการการยืม-คืนอุปกรณ์ กล้อง โน๊ตบุ๊ค และอุปกรณ์สื่อต่างๆ"
            onClick={() => onSelectSystem('equipment')}
          />
          <SystemCard
            icon="🏢"
            title={APP_CONFIG.systemTitle}
            description="จองห้องประชุมออนไลน์ ตรวจสอบความพร้อม และจัดการการจอง"
            onClick={() => onSelectSystem('room')}
          />
        </div>
        <div className="mt-16 text-center flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onAdminLogin}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
              isAdmin
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200'
            }`}
          >
            {isAdmin ? '✅ โหมดเจ้าหน้าที่ทำงานอยู่' : '🔑 เข้าสู่โหมดเจ้าหน้าที่'}
          </button>
          <button
            onClick={handleCheckStatus}
            disabled={isCheckingStatus}
            className="px-4 py-2 rounded-full text-xs font-bold transition-all border bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200 disabled:opacity-50 flex items-center gap-2"
          >
            {isCheckingStatus ? (
              <>
                <LoadingSpinner />
                <span>กำลังตรวจสอบ...</span>
              </>
            ) : (
              <>
                <span>⚙️</span>
                <span>ตรวจสอบการตั้งค่า</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default LandingPage;