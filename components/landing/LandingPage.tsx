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

// SVG icon: แจ้งซ่อม (ประแจ)
const RepairIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>
);

const LandingPage: React.FC<LandingPageProps> = ({ onAdminLogin, isAdmin }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-neutral-bg">
      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden flex flex-col items-center justify-center px-6 py-20 md:py-28 text-center bg-gradient-to-br from-primary via-blue-600 to-primary-hover">
        {/* เส้นตกแต่ง */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, var(--accent) 0%, transparent 50%), radial-gradient(circle at 80% 20%, #60a5fa 0%, transparent 40%)',
          }}
        />

        {/* Logo / Badge */}
        <div className="relative z-10 inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-bold tracking-widest uppercase bg-white/15 text-blue-100 border border-white/20">
          <span className="inline-block w-2 h-2 rounded-full animate-pulse bg-accent" />
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
          className="relative z-10 font-medium mb-10 text-blue-200"
          style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}
        >
          {APP_CONFIG.collegeName}
        </p>

        {/* คลื่นล่าง */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60 C360 0 1080 0 1440 60 L1440 60 L0 60 Z" className="fill-neutral-bg"/>
          </svg>
        </div>
      </div>

      {/* ── Cards Section ── */}
      <div className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* การ์ดระบบยืมอุปกรณ์ */}
          <button
            onClick={() => navigate('/equipment')}
            className="group card-hover text-left w-full rounded-[24px] p-8 bg-white border border-slate-200 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] mb-5 bg-primary-light text-primary transition-colors duration-300">
              <EquipmentIcon />
            </div>
            <h2 className="font-bold mb-2 text-[1.2rem] text-primary tracking-tight">
              {APP_CONFIG.equipmentTitle}
            </h2>
            <p className="text-neutral-muted text-sm leading-[1.6]">
              จัดการการยืม-คืนอุปกรณ์ กล้อง โน้ตบุ๊ก และอุปกรณ์สื่อต่างๆ
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent">
              ยืมอุปกรณ์
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          {/* การ์ดระบบจองห้อง */}
          <button
            onClick={() => navigate('/room')}
            className="group card-hover text-left w-full rounded-[24px] p-8 bg-white border border-slate-200 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] mb-5 bg-primary-light text-primary transition-colors duration-300">
              <RoomIcon />
            </div>
            <h2 className="font-bold mb-2 text-[1.2rem] text-primary tracking-tight">
              {APP_CONFIG.systemTitle}
            </h2>
            <p className="text-neutral-muted text-sm leading-[1.6]">
              จองห้องประชุมออนไลน์ ตรวจสอบความพร้อม และจัดการการจอง
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent">
              จองห้องประชุม
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>

          {/* การ์ดระบบแจ้งซ่อมอุปกรณ์ไอที */}
          <button
            onClick={() => navigate('/repair')}
            className="group card-hover text-left w-full rounded-[24px] p-8 bg-white border border-slate-200 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] mb-5 bg-primary-light text-primary transition-colors duration-300">
              <RepairIcon />
            </div>
            <h2 className="font-bold mb-2 text-[1.2rem] text-primary tracking-tight">
              {APP_CONFIG.repairTitle}
            </h2>
            <p className="text-neutral-muted text-sm leading-[1.6]">
              แจ้งเครื่องคอมพิวเตอร์เสีย โปรแกรมมีปัญหา หรือเน็ตใช้ไม่ได้ พร้อมแจ้งเตือนเจ้าหน้าที่ทันที
            </p>
            <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent">
              แจ้งซ่อม
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          </button>
        </div>

        {/* ── Admin button ── */}
        <button
          onClick={onAdminLogin}
          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all duration-200 border cursor-pointer ${
            isAdmin
              ? 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
              : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
          }`}
        >
          {isAdmin ? '✅ โหมดเจ้าหน้าที่ทำงานอยู่' : '🔑 เข้าสู่โหมดเจ้าหน้าที่'}
        </button>
      </div>

      {/* ── Footer ── */}
      <footer className="py-6 text-center text-slate-400 text-xs">
        © {new Date().getFullYear()} {APP_CONFIG.collegeName} — ระบบบริการดิจิทัล
      </footer>
    </div>
  );
};

export default LandingPage;