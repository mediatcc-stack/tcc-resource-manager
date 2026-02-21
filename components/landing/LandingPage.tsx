import React from 'react';
import { useNavigate } from 'react-router-dom';
import SystemCard from './SystemCard';
import { APP_CONFIG } from '../../constants';

interface LandingPageProps {
  onAdminLogin: () => void;
  isAdmin: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onAdminLogin, isAdmin }) => {
  const navigate = useNavigate();
  return (
    <>
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
            onClick={() => navigate('/equipment')}
          />
          <SystemCard
            icon="🏢"
            title={APP_CONFIG.systemTitle}
            description="จองห้องประชุมออนไลน์ ตรวจสอบความพร้อม และจัดการการจอง"
            onClick={() => navigate('/room')}
          />
        </div>
        <div className="mt-16 text-center">
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
        </div>
      </div>
    </>
  );
};

export default LandingPage;