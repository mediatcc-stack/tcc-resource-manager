import React from 'react';
import { SystemType } from '../../types';
import SystemCard from './SystemCard';
import { APP_CONFIG } from '../../constants';

interface LandingPageProps {
  onSelectSystem: (system: SystemType) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelectSystem }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-5 text-center animate-fade-in">
      <h1 className="text-4xl md:text-6xl font-bold mb-4 text-shadow-md bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-300">
        ระบบจองห้องและยืมอุปกรณ์
      </h1>
      <p className="text-xl md:text-2xl text-white/95 mb-12 text-shadow">
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
    </div>
  );
};

export default LandingPage;