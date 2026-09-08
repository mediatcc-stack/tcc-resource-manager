import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '../../constants';
import { GraduationCap, ArrowLeft, Building2, ShieldCheck, KeyRound } from 'lucide-react';

interface NavbarProps {
  isAdmin: boolean;
  onAdminToggle: () => void;
}

// รายการเมนูหลัก — ตรงกับ Route ใน App.tsx
const NAV_ITEMS: { path: string; label: string }[] = [
  { path: '/',          label: 'หน้าแรก' },
  { path: '/room',      label: APP_CONFIG.systemTitle },
  { path: '/equipment', label: APP_CONFIG.equipmentTitle },
  { path: '/repair',    label: APP_CONFIG.repairTitle },
];

/**
 * แถบหัวเรื่องแบบ 2 ชั้น (fixed)
 *  ชั้นบน  — แบรนด์ระบบ + สถานะ/ปุ่มโหมดเจ้าหน้าที่
 *  ชั้นล่าง — ปุ่มกลับหน้าแรก + แท็บเลือกระบบ
 */
const Navbar: React.FC<NavbarProps> = ({ isAdmin, onAdminToggle }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  // บนจอแคบแถบเมนูเลื่อนแนวนอนได้ — เลื่อนให้เห็นระบบที่กำลังใช้งานอยู่เสมอ
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [currentPath]);

  return (
    <header className="fixed top-0 left-0 w-full z-50 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      {/* ── ชั้นบน: แบรนด์ ── */}
      <div className="bg-gradient-to-r from-primary to-primary-container text-on-primary">
        <div className="max-w-content mx-auto px-gutter-mobile md:px-gutter-tablet lg:px-gutter-desktop h-16 flex items-center justify-between gap-space-md">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-space-sm text-left cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-on-primary backdrop-blur-md shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-headline-sm tracking-tight leading-tight text-on-primary">
                ระบบบริหารจัดการทรัพยากรส่วนกลาง
              </span>
              <span className="font-body text-body-sm text-on-primary-container leading-none mt-0.5 hidden sm:block">
                {APP_CONFIG.collegeName} — งานสื่อดิจิทัลและสื่อสารองค์กร
              </span>
            </div>
          </button>

          <div className="flex items-center gap-space-sm shrink-0">
            {isAdmin && (
              <div className="hidden sm:flex items-center gap-space-xs bg-white/10 px-space-sm py-1.5 rounded-full backdrop-blur-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
                </span>
                <span className="font-label text-label-sm text-on-primary tracking-wide">
                  โหมดเจ้าหน้าที่ทำงานอยู่
                </span>
              </div>
            )}
            <button
              onClick={onAdminToggle}
              title={isAdmin ? 'ออกจากโหมดเจ้าหน้าที่' : 'เข้าสู่โหมดเจ้าหน้าที่'}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-on-primary hover:bg-white/20 transition-colors cursor-pointer"
            >
              {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── ชั้นล่าง: เมนูระบบ ── */}
      <div className="bg-surface/90 backdrop-blur-xl">
        <div className="max-w-content mx-auto px-gutter-mobile md:px-gutter-tablet lg:px-gutter-desktop h-12 flex items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md overflow-x-auto py-1">
            {currentPath !== '/' && (
              <>
                <button
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-1.5 px-space-sm py-1.5 rounded-lg font-label text-label-md text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>หน้าแรกระบบ</span>
                </button>
                <div className="h-4 w-px bg-outline-variant shrink-0" />
              </>
            )}

            <nav className="flex items-center gap-space-xs shrink-0">
              {NAV_ITEMS.map(item => {
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    ref={isActive ? activeTabRef : undefined}
                    onClick={() => navigate(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`px-space-sm py-1.5 rounded-lg font-label text-label-md whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-primary-container text-on-primary font-bold shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-space-xs text-on-surface-variant font-label text-label-sm shrink-0">
            <Building2 className="w-4 h-4" />
            <span>งานสื่อดิจิทัลและสื่อสารองค์กร</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
