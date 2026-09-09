/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  PageTransition.tsx — โมชั่นตอนเปลี่ยนหน้า (เปลี่ยนระบบ)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ครอบ <Routes> ไว้ใน App.tsx เพื่อให้ทุกครั้งที่เปลี่ยน URL
 *    - เนื้อหาหน้าใหม่เลื่อนเข้ามาตามทิศทางของเมนู (ขวา = ไปหน้าถัดไป, ซ้าย = ย้อนกลับ)
 *      ใช้ชุดโมชั่นเดียวกับการปัดสลับแท็บในแต่ละระบบ (useSwipeableTabs)
 *    - เลื่อนจอกลับขึ้นบนสุดเสมอ ไม่ค้างอยู่ตำแหน่งเดิมของหน้าก่อนหน้า
 *
 *  ผู้ใช้ที่ตั้งค่า "ลดการเคลื่อนไหว" ในระบบปฏิบัติการจะไม่เห็นอนิเมชัน
 *  (กำหนดไว้ที่ prefers-reduced-motion ใน index.css)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** ลำดับหน้าตามเมนูในแถบหัวเรื่อง — ใช้ตัดสินว่าโมชั่นควรมาจากซ้ายหรือขวา */
const ROUTE_ORDER = ['/', '/room', '/equipment', '/repair'];

const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [previousPath, setPreviousPath] = useState(location.pathname);
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null);

  // คำนวณทิศทางระหว่าง render (รูปแบบ "ปรับ state เมื่อ props เปลี่ยน" ของ React)
  // เพื่อให้หน้าใหม่ได้ class ที่ถูกต้องตั้งแต่เฟรมแรก ไม่กระพริบ
  if (previousPath !== location.pathname) {
    const from = ROUTE_ORDER.indexOf(previousPath);
    const to = ROUTE_ORDER.indexOf(location.pathname);
    setDirection(from >= 0 && to >= 0 && from !== to ? (to > from ? 'forward' : 'backward') : null);
    setPreviousPath(location.pathname);
  }

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  const animationClass =
    direction === 'forward' ? 'animate-swipe-from-right'
    : direction === 'backward' ? 'animate-swipe-from-left'
    : 'animate-fade-in';

  return (
    <div key={location.pathname} className={animationClass}>
      {children}
    </div>
  );
};

export default PageTransition;
