/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  App.tsx — Root Component ของระบบ TCC Resource Manager
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  📁 SOURCE CODE (GitHub)
 *  ─────────────────────────────────────────────────────────────────────────────
 *  Repository : https://github.com/[your-org]/tcc-resource-manager
 *  ไฟล์นี้    : App.tsx  (root ของ project)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🗺️  โครงสร้าง Pages และ Routing
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  URL "/"          → LandingPage    — หน้าแรก เลือกระบบ
 *  URL "/room"      → RoomBookingSystem — ระบบจองห้องประชุม
 *  URL "/equipment" → EquipmentSystem   — ระบบยืมอุปกรณ์
 *  URL อื่นๆ        → redirect ไป "/"
 *
 *  ไฟล์ _redirects (root ของ project) ทำให้ Cloudflare Pages รองรับ React Router:
 *    /* /index.html 200
 *  ⚠️  ถ้าลบไฟล์ _redirects จะทำให้ URL โดยตรง (เช่น /room) แสดง 404!
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  👨‍💼  ระบบ Admin (โหมดเจ้าหน้าที่)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  การล็อกอิน Admin:
 *    หน้า Landing → ปุ่ม "เข้าสู่โหมดเจ้าหน้าที่" → กรอกรหัสผ่าน
 *    รหัสผ่านตรวจสอบกับ ADMIN_PASSWORD ใน Cloudflare Worker Settings
 *
 *  สิ่งที่ Admin ทำได้เพิ่มเติม (เมื่อ isAdmin = true):
 *    - ยกเลิก/แก้ไข/ลบการจองของคนอื่น (หน้า MyBookingsPage)
 *    - เปลี่ยนสถานะการยืมอุปกรณ์ (หน้า BorrowingListPage)
 *    - ลบรายการถาวร
 *
 *  ⚠️  TODO: ควรเปลี่ยนจาก prompt() เป็น Modal component (ดู Modal.tsx ที่ว่างอยู่)
 *  ⚠️  TODO: isAdmin หายเมื่อ refresh — ควรเพิ่ม sessionStorage เก็บ token
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🍞  Toast Notification System
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  showToast(message, type) — ส่ง prop ลงไปให้ทุก Component ลูก
 *  type: 'success' | 'error'
 *  แสดง Toast ลอยขึ้นมาที่มุมล่างขวา auto-dismiss หลัง 4 วินาที
 *
 *  ⚠️  TODO: ควรเปลี่ยนเป็น React Context แทน prop drilling ในอนาคต
 *           เพื่อไม่ต้องส่ง showToast ผ่านหลายชั้น
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🚀  การ Deploy Frontend (Cloudflare Pages)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  Build command : npm run build
 *  Output folder : dist/
 *
 *  วิธีที่ 1 — ผ่าน Cloudflare Dashboard (ง่ายที่สุด):
 *    npm run build → ลาก folder dist/ ไปวางที่ Cloudflare Pages Dashboard
 *
 *  วิธีที่ 2 — ผ่าน GitHub Integration (อัตโนมัติ):
 *    Cloudflare Pages → เชื่อม GitHub repo
 *    ทุกครั้งที่ push ไป main branch จะ deploy อัตโนมัติ
 *
 *  ⚠️  Environment Variable ที่ต้องตั้งใน Pages Settings:
 *    VITE_API_SECRET_KEY = [ค่าเดียวกับ API_SECRET_KEY ใน Worker]
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🗂️  โครงสร้างไฟล์ทั้งหมด
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  App.tsx                                ← ไฟล์นี้ (root component + routing)
 *  index.tsx                              ← entry point (mount React app)
 *  index.html                             ← HTML template + Tailwind CDN
 *  constants.ts                           ← URL, ชื่อระบบ, รายชื่อห้อง
 *  types.ts                               ← TypeScript type definitions
 *  cloudflare-worker.js                   ← Backend (deploy แยก)
 *  _redirects                             ← Cloudflare Pages SPA config
 *  .env.example                           ← ตัวอย่าง env variables (สำหรับ dev)
 *  services/
 *    apiService.ts                        ← ติดต่อ Worker (fetch/save data)
 *    notificationService.ts               ← ส่ง LINE แจ้งเตือน
 *  components/
 *    landing/LandingPage.tsx              ← หน้าแรก
 *    layout/Navbar.tsx                    ← แถบ navigation บนสุด
 *    room/
 *      RoomBookingSystem.tsx              ← controller ระบบจองห้อง
 *      HomePage.tsx                       ← ปฏิทิน + รายชื่อห้อง
 *      BookingForm.tsx                    ← ฟอร์มกรอกข้อมูลจอง
 *      MyBookingsPage.tsx                 ← จัดการการจองของตัวเอง
 *      StatisticsPage.tsx                 ← สรุปสถิติการใช้ห้อง
 *      BookingDetailsModal.tsx            ← Popup รายละเอียดการจอง
 *    equipment/
 *      EquipmentSystem.tsx                ← controller ระบบยืมอุปกรณ์
 *      BorrowingListPage.tsx              ← รายการการยืมทั้งหมด
 *      BorrowingFormPage.tsx              ← ฟอร์มขอยืมอุปกรณ์
 *      BorrowingStatisticsPage.tsx        ← สรุปสถิติการยืม
 *      BorrowingCard.tsx                  ← การ์ดแสดงรายการยืม
 *    shared/
 *      Button.tsx                         ← ปุ่มมาตรฐาน
 *      LoadingSpinner.tsx                 ← Loading indicator
 *      Modal.tsx                          ← (ว่างอยู่ — TODO)
 *      Toast.tsx / ToastContainer.tsx     ← ระบบ notification
 *      ThaiDatePicker.tsx                 ← Date picker แบบไทย
 *    admin/
 *      ConfigurationStatusModal.tsx       ← ตรวจสอบสถานะ Worker
 *      GroupIdFinder.tsx                  ← (ว่างอยู่ — TODO)
 *      NotificationSettingsModal.tsx      ← (ว่างอยู่ — TODO)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useCallback } from 'react';
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { WORKER_BASE_URL } from './constants';
import LandingPage from './components/landing/LandingPage';
import RoomBookingSystem from './components/room/RoomBookingSystem';
import EquipmentSystem from './components/equipment/EquipmentSystem';
import Navbar from './components/layout/Navbar';
import { SystemType, ToastMessage } from './types';
import ToastContainer from './components/shared/ToastContainer';
import Modal from './components/shared/Modal';
import Button from './components/shared/Button';


const App: React.FC = () => {
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  
  // โหลดสถานะ admin จาก localStorage เพื่อไม่ให้หลุดเมื่อรีเฟรชหรือเปิดจากไลน์ใหม่
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('isAdmin') === 'true';
  });
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const newToast: ToastMessage = {
      id: Date.now() + Math.random(),
      message,
      type,
    };
    setToastMessages(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToastMessages(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // ── ระบบ Login/Logout Admin ──────────────────────────────────────────────────
  const handleAdminToggle = () => {
    if (isAdmin) {
      setIsAdmin(false);
      localStorage.removeItem('isAdmin');
      showToast('ออกจากโหมดเจ้าหน้าที่', 'success');
      return;
    }
    setPassword('');
    setIsLoginModalOpen(true);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      showToast('กรุณากรอกรหัสผ่าน', 'error');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`${WORKER_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIsAdmin(true);
          localStorage.setItem('isAdmin', 'true');
          setIsLoginModalOpen(false);
          showToast('เข้าสู่โหมดเจ้าหน้าที่สำเร็จ', 'success');
        } else {
          showToast('รหัสผ่านไม่ถูกต้อง', 'error');
        }
      } else {
        showToast('รหัสผ่านไม่ถูกต้อง', 'error');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      showToast('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container flex flex-col min-h-screen">
      <Navbar />
      <main className="main-content flex-1 p-4 md:p-8 w-full">
        <Routes>
          <Route path="/"          element={<LandingPage onAdminLogin={handleAdminToggle} isAdmin={isAdmin} />} />
          <Route path="/room"      element={<RoomBookingSystem showToast={showToast} isAdmin={isAdmin} />} />
          <Route path="/equipment" element={<EquipmentSystem showToast={showToast} isAdmin={isAdmin} />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ToastContainer messages={toastMessages} onRemove={removeToast} />

      {/* ── Modal ล็อกอินเจ้าหน้าที่ ── */}
      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => !isSubmitting && setIsLoginModalOpen(false)}
        title="🔑 เข้าสู่โหมดเจ้าหน้าที่ (Admin)"
        size="sm"
      >
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
              รหัสผ่านเจ้าหน้าที่
            </label>
            <input
              type="password"
              placeholder="กรุณากรอกรหัสผ่าน..."
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-slate-800 placeholder-slate-400 font-medium"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setIsLoginModalOpen(false)}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
            >
              เข้าสู่ระบบ
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default App;

