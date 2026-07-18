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

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M15 18l-6-6 6-6"/>
  </svg>
);

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  if (currentPath === '/') return null;

  const systemTitles: Record<string, string> = {
    '/room': APP_CONFIG.systemTitle,
    '/equipment': APP_CONFIG.equipmentTitle,
  };

  const systemIcons: Record<string, React.ReactNode> = {
    '/room': <RoomIcon />,
    '/equipment': <CameraIcon />,
  };

  const title = systemTitles[currentPath] ?? 'TCC Resource Manager';
  const icon = systemIcons[currentPath] ?? null;

  return (
    <header
      className="sticky top-0 z-40 w-full"
      style={{
        background: 'linear-gradient(135deg, #0D448D 0%, #1a5ba8 100%)',
        boxShadow: '0 2px 16px rgba(13,68,141,0.25)',
      }}
    >
      <div className="h-14 flex items-center justify-between px-4 md:px-8">
        {/* ชื่อระบบ + ไอคอน */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.18)', color: 'white' }}
          >
            {icon}
          </div>
          <div>
            <p
              className="hidden sm:block font-bold text-white leading-tight"
              style={{ fontSize: '0.95rem', letterSpacing: '-0.01em' }}
            >
              {title}
            </p>
            <p className="text-xs" style={{ color: '#bfdbfe' }}>
              {APP_CONFIG.collegeName}
            </p>
          </div>
        </div>

        {/* ปุ่มกลับหน้าหลัก */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 transition-all duration-200 active:scale-95"
          style={{
            padding: '7px 14px',
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: 'white',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        >
          <ChevronLeft />
          <HomeIcon />
          <span className="hidden md:inline">กลับเมนูหลัก</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;