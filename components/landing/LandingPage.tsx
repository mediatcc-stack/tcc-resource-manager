import React from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '../../constants';

interface LandingPageProps {
  onAdminLogin: () => void;
  isAdmin: boolean;
}

// SVG icon: กล้อง/อุปกรณ์สื่อ
const EquipmentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>
  </svg>
);

// SVG icon: ห้องประชุม
const RoomIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const LandingPage: React.FC<LandingPageProps> = ({ onAdminLogin, isAdmin }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>
      {/* ── Hero Section ── */}
      <div
        className="relative overflow-hidden flex flex-col items-center justify-center px-6 py-20 md:py-28 text-center"
        style={{
          background: 'linear-gradient(135deg, #0D448D 0%, #1a5ba8 50%, #0b356f 100%)',
        }}
      >
        {/* เส้นตกแต่ง */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, #f97316 0%, transparent 50%), radial-gradient(circle at 80% 20%, #60a5fa 0%, transparent 40%)',
          }}
        />

        {/* Logo / Badge */}
        <div
          className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-bold tracking-widest uppercase"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#bfdbfe', border: '1px solid rgba(255,255,255,0.2)' }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#f97316' }}
          />
          ระบบบริการดิจิทัล
        </div>

        <h1
          className="relative z-10 font-black text-white mb-4 leading-tight"
          style={{
            fontSize: 'clamp(1.8rem, 5vw, 3.5rem)',
            textWrap: 'balance',
            letterSpacing: '-0.02em',
          }}
        >
          ระบบจองห้องและยืมอุปกรณ์
        </h1>
        <p
          className="relative z-10 font-medium mb-10"
          style={{ color: '#bfdbfe', fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}
        >
          {APP_CONFIG.collegeName}
        </p>

        {/* คลื่นล่าง */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60 C360 0 1080 0 1440 60 L1440 60 L0 60 Z" fill="#f8fafc"/>
          </svg>
        </div>
      </div>

      {/* ── Cards Section ── */}
      <div className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* การ์ดระบบยืมอุปกรณ์ */}
          <button
            onClick={() => navigate('/equipment')}
            className="group text-left w-full rounded-3xl p-8 transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2"
            style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 28px rgba(13,68,141,0.14)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#0D448D';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
            }}
          >
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 transition-colors duration-300"
              style={{ background: '#eff6ff', color: '#0D448D' }}
            >
              <EquipmentIcon />
            </div>
            <h2
              className="font-bold mb-2"
              style={{ fontSize: '1.2rem', color: '#0D448D', letterSpacing: '-0.01em' }}
            >
              {APP_CONFIG.equipmentTitle}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6' }}>
              จัดการการยืม-คืนอุปกรณ์ กล้อง โน้ตบุ๊ก และอุปกรณ์สื่อต่างๆ
            </p>
            <div
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold transition-colors duration-200"
              style={{ color: '#f97316' }}
            >
              ยืมอุปกรณ์
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          {/* การ์ดระบบจองห้อง */}
          <button
            onClick={() => navigate('/room')}
            className="group text-left w-full rounded-3xl p-8 transition-all duration-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2"
            style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 12px 28px rgba(13,68,141,0.14)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#0D448D';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)';
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
            }}
          >
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 transition-colors duration-300"
              style={{ background: '#eff6ff', color: '#0D448D' }}
            >
              <RoomIcon />
            </div>
            <h2
              className="font-bold mb-2"
              style={{ fontSize: '1.2rem', color: '#0D448D', letterSpacing: '-0.01em' }}
            >
              {APP_CONFIG.systemTitle}
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.6' }}>
              จองห้องประชุมออนไลน์ ตรวจสอบความพร้อม และจัดการการจอง
            </p>
            <div
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold transition-colors duration-200"
              style={{ color: '#f97316' }}
            >
              จองห้องประชุม
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>
        </div>

        {/* ── Admin button ── */}
        <button
          onClick={onAdminLogin}
          className="transition-all duration-200"
          style={{
            padding: '8px 20px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            border: isAdmin ? '1.5px solid #bbf7d0' : '1.5px solid #e2e8f0',
            background: isAdmin ? '#f0fdf4' : '#f8fafc',
            color: isAdmin ? '#16a34a' : '#94a3b8',
            cursor: 'pointer',
          }}
        >
          {isAdmin ? '✅  โหมดเจ้าหน้าที่ทำงานอยู่' : '🔑  เข้าสู่โหมดเจ้าหน้าที่'}
        </button>
      </div>

      {/* ── Footer ── */}
      <footer className="py-6 text-center" style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
        © {new Date().getFullYear()} {APP_CONFIG.collegeName} — ระบบบริการดิจิทัล
      </footer>
    </div>
  );
};

export default LandingPage;