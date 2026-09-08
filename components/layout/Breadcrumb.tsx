import React from 'react';
import { useLocation } from 'react-router-dom';
import { APP_CONFIG } from '../../constants';
import { Home, ChevronRight } from 'lucide-react';

const PAGE_LABELS: Record<string, string> = {
  '/':          'พอร์ทัลบริการ',
  '/room':      APP_CONFIG.systemTitle,
  '/equipment': APP_CONFIG.equipmentTitle,
  '/repair':    APP_CONFIG.repairTitle,
};

/** แถบเส้นทางการใช้งาน (breadcrumb) ใต้แถบเมนู */
const Breadcrumb: React.FC = () => {
  const { pathname } = useLocation();
  const label = PAGE_LABELS[pathname] ?? 'พอร์ทัลบริการ';

  return (
    <div className="flex items-center gap-space-xs text-on-surface-variant font-label text-label-sm mb-space-sm">
      <Home className="w-4 h-4" />
      <span>ระบบกลาง</span>
      <ChevronRight className="w-3.5 h-3.5" />
      <span className="text-on-surface font-semibold">{label}</span>
    </div>
  );
};

export default Breadcrumb;
