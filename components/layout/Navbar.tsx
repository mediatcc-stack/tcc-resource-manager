
import React from 'react';
import { SystemType } from '../../types';
import { APP_CONFIG } from '../../constants';

interface NavbarProps {
  currentSystem: SystemType;
  onBackToLanding: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentSystem, onBackToLanding }) => {
  if (currentSystem === 'landing') {
    return null;
  }

  const systemTitles: Record<SystemType, string> = {
    room: APP_CONFIG.systemTitle,
    equipment: APP_CONFIG.equipmentTitle,
    landing: '',
  };
  
  const systemIcon: Record<SystemType, string> = {
    room: '🏢',
    equipment: '📷',
    landing: '',
  };

  return (
    <header className="sticky top-0 z-40 w-full animate-fade-in">
      <div className="h-16 flex items-center justify-between px-4 md:px-8 bg-white/70 backdrop-blur-sm border-b border-gray-200/50 shadow-sm">
        <div className="flex items-center gap-3">
            <span className="text-2xl">{systemIcon[currentSystem]}</span>
            <h1 className="text-md md:text-lg font-bold text-[#0D448D] hidden sm:block">
                {systemTitles[currentSystem]}
            </h1>
        </div>
        <button 
          onClick={onBackToLanding}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg text-xs font-semibold hover:bg-gray-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
        >
          <span>🏠</span>
          <span className="hidden md:inline">กลับเมนูหลัก</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
