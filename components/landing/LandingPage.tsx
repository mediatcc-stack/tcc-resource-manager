import React from 'react';
import { useNavigate } from 'react-router-dom';
import { APP_CONFIG } from '../../constants';
import { Camera, DoorOpen, Wrench, ArrowRight, KeyRound, ChevronRight, ShieldCheck } from 'lucide-react';

interface LandingPageProps {
  onAdminLogin: () => void;
  isAdmin: boolean;
}

// ── ระบบบริการทั้งหมดบนพอร์ทัล ─────────────────────────────────────────────
const SYSTEMS: {
  path: string;
  title: string;
  tag: string;
  description: string;
  cta: string;
  icon: React.ReactNode;
}[] = [
  {
    path: '/equipment',
    title: APP_CONFIG.equipmentTitle,
    tag: 'ยืม–คืนอุปกรณ์',
    description: 'จัดการการยืม-คืนอุปกรณ์ กล้อง โน้ตบุ๊ก และอุปกรณ์สื่อต่างๆ',
    cta: 'ยืมอุปกรณ์',
    icon: <Camera className="w-7 h-7" />,
  },
  {
    path: '/room',
    title: APP_CONFIG.systemTitle,
    tag: 'จอง / ตารางใช้ห้อง',
    description: 'จองห้องประชุมออนไลน์ ตรวจสอบความพร้อม และจัดการการจอง',
    cta: 'จองห้องประชุม',
    icon: <DoorOpen className="w-7 h-7" />,
  },
  {
    path: '/repair',
    title: APP_CONFIG.repairTitle,
    tag: 'แจ้งซ่อม / ติดตามงาน',
    description: 'แจ้งเครื่องคอมพิวเตอร์เสีย โปรแกรมมีปัญหา หรือเน็ตใช้ไม่ได้ พร้อมแจ้งเตือนเจ้าหน้าที่ทันที',
    cta: 'แจ้งซ่อม',
    icon: <Wrench className="w-7 h-7" />,
  },
];

const LandingPage: React.FC<LandingPageProps> = ({ onAdminLogin, isAdmin }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col w-full animate-fade-in">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-primary via-primary-container to-secondary text-on-primary py-12 md:py-16 px-space-md md:px-space-2xl shadow-xl shadow-primary/10">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center space-y-4 md:space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md shadow-sm">
            <span className="inline-block w-2 h-2 rounded-full bg-accent" />
            <span className="font-label text-label-sm tracking-wide text-on-primary">ระบบบริการดิจิทัล</span>
          </div>

          <h1 className="font-display text-headline-lg-mobile md:text-display-hero text-on-primary tracking-tight max-w-3xl">
            ระบบงานสื่อดิจิทัลและสื่อสารองค์กร
          </h1>

          <p className="font-heading text-headline-sm md:text-headline-md text-on-primary-container tracking-wide">
            {APP_CONFIG.collegeName}
          </p>
        </div>
      </section>

      {/* ── การ์ดเลือกระบบ ─────────────────────────────────────────────────── */}
      <section className="w-full -mt-6 md:-mt-8 px-2 md:px-4 z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1280px] mx-auto">
          {SYSTEMS.map(system => (
            <button
              key={system.path}
              onClick={() => navigate(system.path)}
              className="group relative text-left bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-card hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center text-secondary-container shadow-inner shrink-0">
                    {system.icon}
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high/60 text-primary font-label text-label-sm">
                    {system.tag}
                  </span>
                </div>

                <h2 className="font-heading text-headline-md md:text-headline-lg text-on-surface mb-3 tracking-tight">
                  {system.title}
                </h2>
                <p className="font-body text-body-md text-on-surface-variant leading-relaxed mb-6">
                  {system.description}
                </p>
              </div>

              <div className="pt-4 mt-auto">
                <span className="inline-flex items-center gap-2 font-label text-label-lg text-accent group-hover:text-primary transition-colors">
                  {system.cta}
                  <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1.5" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── โหมดเจ้าหน้าที่ ────────────────────────────────────────────────── */}
      <section className="w-full mt-10 md:mt-14 mb-4 flex flex-col items-center justify-center gap-4">
        <button
          onClick={onAdminLogin}
          className={`group inline-flex items-center gap-2.5 px-6 py-3 rounded-full font-label text-label-md shadow-sm transition-all duration-200 active:scale-95 cursor-pointer ${
            isAdmin
              ? 'bg-success-container text-on-success-container hover:brightness-95'
              : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
          }`}
        >
          {isAdmin
            ? <ShieldCheck className="w-4 h-4" />
            : <KeyRound className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />}
          <span className="tracking-wide">
            {isAdmin ? 'โหมดเจ้าหน้าที่ทำงานอยู่ (กดเพื่อออก)' : 'เข้าสู่โหมดเจ้าหน้าที่'}
          </span>
          <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:translate-x-0.5 transition-all" />
        </button>

        <div className="flex flex-wrap items-center justify-center gap-4 text-outline font-label text-label-sm mt-1">
          <span>งานสื่อดิจิทัลและสื่อสารองค์กร</span>
          <span>•</span>
          <span>{APP_CONFIG.collegeName}</span>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
