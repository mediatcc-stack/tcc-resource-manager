import React from 'react';
import { APP_CONFIG } from '../../constants';
import { GraduationCap } from 'lucide-react';

/** ส่วนท้ายของทุกหน้า */
const Footer: React.FC = () => (
  <footer className="w-full bg-surface-container-low mt-space-2xl py-space-xl">
    <div className="max-w-content mx-auto px-gutter-mobile md:px-gutter-tablet lg:px-gutter-desktop flex flex-col md:flex-row items-center justify-between gap-space-md">
      <div className="flex items-center gap-space-sm">
        <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary flex items-center justify-center shrink-0">
          <GraduationCap className="w-4 h-4" />
        </div>
        <div className="text-left">
          <p className="font-label text-label-md text-on-surface">{APP_CONFIG.collegeName}</p>
          {/* สองหน่วยงานที่ดูแลระบบร่วมกัน */}
          <p className="font-body text-body-sm text-on-surface-variant">{APP_CONFIG.departments[0]}</p>
          <p className="font-body text-body-sm text-on-surface-variant">ร่วมกับ {APP_CONFIG.departments[1]}</p>
        </div>
      </div>
      <div className="font-body text-body-sm text-on-surface-variant text-center md:text-right">
        <p>© {new Date().getFullYear()} {APP_CONFIG.collegeName} — ระบบบริการดิจิทัล</p>
        <p className="text-outline font-label text-label-sm mt-0.5">
          ระบบบริหารจัดการทรัพยากรส่วนกลางและงานบริการดิจิทัล
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
