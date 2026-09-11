/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  BottomNav.tsx — แถบเมนูล่างแบบแอปโทรศัพท์ (เฉพาะจอเล็ก)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  บนจอเล็กเมนูระบบย้ายลงมาอยู่ล่างสุด แตะด้วยนิ้วโป้งได้ถนัดกว่าเมนูบนหัวเรื่อง
 *  (จอ md ขึ้นไปซ่อนแถบนี้ และใช้แท็บบน Navbar แทน — ดู Navbar.tsx)
 *
 *  ลำดับเมนูตรงกับลำดับการปัดเปลี่ยนหน้า (hooks/useSwipeNavigation → SWIPE_STEPS)
 *    หน้าแรก → จองห้อง → แจ้งซ่อม → ยืมของ
 *
 *  ⚠️  ความสูงของแถบนี้ถูกกันที่ไว้ด้วย --bottom-nav-height ใน index.css
 *      (ค่าเป็น 0 บนจอ md ขึ้นไป) = h-16 + เส้นขอบบน 1px + safe area ของเครื่อง
 *      ถ้าแก้ความสูงที่นี่ ต้องแก้ค่านั้นให้ตรงกันด้วย ไม่อย่างนั้นแถบจะทับเนื้อหาท้ายหน้า
 *
 *  ⚠️  พื้นหลังต้องทึบ (ไม่ใช้ /95 + blur) เพราะเนื้อหาที่เลื่อนผ่านใต้แถบจะอ่านทะลุขึ้นมา
 *      แข่งกับชื่อเมนู
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, DoorOpen, Wrench, Camera } from 'lucide-react';

// ใช้ชื่อสั้นกว่าเมนูบนหัวเรื่อง เพราะช่องละ 1 ใน 4 ของความกว้างจอ
const BOTTOM_NAV_ITEMS: { path: string; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { path: '/',          label: 'หน้าแรก',  Icon: Home },
  { path: '/room',      label: 'จองห้อง',  Icon: DoorOpen },
  { path: '/repair',    label: 'แจ้งซ่อม', Icon: Wrench },
  { path: '/equipment', label: 'ยืมของ',   Icon: Camera },
];

/** แถบเมนูล่าง 4 ไอคอน — ซ่อนบนจอ md ขึ้นไป */
const BottomNav: React.FC = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      aria-label="เมนูระบบ"
      className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-surface-container-lowest border-t border-outline-variant shadow-[0_-2px_12px_rgba(15,23,42,0.08)] pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="h-16 flex items-stretch">
        {BOTTOM_NAV_ITEMS.map(({ path, label, Icon }) => {
          const isActive = pathname === path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              aria-current={isActive ? 'page' : undefined}
              className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 transition-transform active:scale-95 cursor-pointer"
            >
              <span
                className={`flex items-center justify-center h-7 w-14 rounded-full transition-colors ${
                  isActive ? 'bg-secondary-fixed text-on-secondary-fixed' : 'text-on-surface-variant'
                }`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span
                className={`font-label text-label-sm truncate max-w-full px-0.5 transition-colors ${
                  isActive ? 'text-primary font-bold' : 'text-on-surface-variant'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
