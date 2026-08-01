import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '../../constants';

// SVG icons
const CameraIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>
  </svg>
);

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const RoomIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8M12 17v4"/>
  </svg>
);

const WrenchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);

const AppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="12 8 8 12 12 16 16 12 12 8"/>
  </svg>
);

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
);

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const isLanding = currentPath === '/';

  const systemTitles: Record<string, string> = {
    '/room': APP_CONFIG.systemTitle,
    '/equipment': APP_CONFIG.equipmentTitle,
    '/repair': APP_CONFIG.repairTitle,
  };

  const systemIcons: Record<string, React.ReactNode> = {
    '/room': <RoomIcon />,
    '/equipment': <CameraIcon />,
    '/repair': <WrenchIcon />,
  };

  const title = isLanding ? 'ระบบบริหารจัดการทรัพยากรส่วนกลาง' : (systemTitles[currentPath] ?? 'TCC Resource Manager');
  const icon = isLanding ? <AppIcon /> : (systemIcons[currentPath] ?? null);

  return (
    <header className="sticky top-0 z-40 w-full bg-gradient-to-br from-primary to-blue-600 shadow-md shadow-primary/25">
      <div className="h-14 flex items-center justify-between px-4 md:px-8">
        {/* ชื่อระบบ + ไอคอน */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 text-white">
            {icon}
          </div>
          <div>
            <p className="font-bold text-white leading-tight text-[13.5px] tracking-tight">
              {title}
            </p>
            <p className="text-[10px] text-blue-200">
              {APP_CONFIG.collegeName}
            </p>
          </div>
        </div>

        {/* ปุ่มกลับหน้าหลัก — แสดงเมื่อไม่อยู่หน้า Landing เท่านั้น */}
        {!isLanding && (
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold transition-all duration-200 active:scale-95 hover:bg-white/20 cursor-pointer backdrop-blur-[4px]"
          >
            <HomeIcon />
            <span>หน้าแรกระบบ</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;