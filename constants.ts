
import { Room } from './types';

// ตรงกับ URL ในหน้า Cloudflare ของคุณ (Workers.dev)
export const WORKER_BASE_URL = 'https://tcc-line-notifier.media-tcc.workers.dev';

// URL สำหรับส่งแจ้งเตือน (เปลี่ยนกลับมาใช้ Cloudflare Worker Endpoint)
export const NOTIFICATION_URL = `${WORKER_BASE_URL}/notify`;

// ลิงก์ปัจจุบันของระบบ
export const APP_URL = 'https://tcc-media-booking.pages.dev';

export const APP_CONFIG = {
  systemTitle: "ระบบจองห้องประชุม",
  equipmentTitle: "ระบบขอยืมอุปกรณ์งานสื่อฯ",
  collegeName: "วิทยาลัยพณิชยการธนบุรี",
};

export const ROOMS: Room[] = [
  { id: 1, name: "ห้องประชุมธีรธรรมานันท์", status: 'available' },
  { id: 2, name: "ห้องประชุมเฉลิมพระเกียรติ", status: 'available' },
  { id: 3, name: "ห้องประชุมมูลนิธิสมเด็จพระธีรญาณมุนี", status: 'available' },
  { id: 4, name: "ห้องประชุมสำเภาทอง", status: 'available' },
  { id: 7, name: "ห้องงานสื่อการเรียนการสอน 421", status: 'available' },
  { id: 8, name: "ห้อง CVM (ศูนย์บริหารเครือข่าย)", status: 'available' },
  { id: 9, name: "ลานโดมอเนกประสงค์", status: 'available' },
  { id: 5, name: "ห้องประชุมไพโรจน์ปวะบุตร", status: 'closed' },
  { id: 6, name: "หอประชุมประทีป ปฐมกสิกุล", status: 'closed' }
];

export const STAFF_PASSWORDS = ['010', 'media@2021', 'tcc2024'];

export const EQUIPMENT_CATEGORIES = [
    { title: "กล้องและวิดีโอ", items: "DSLR, Mirrorless, วิดีโอ" },
    { title: "ระบบเสียง", items: "ไมค์ลอย, ลำโพงพกพา" },
    { title: "อุปกรณ์เสริม", items: "ขาตั้งกล้อง, Gimbal" },
    { title: "คอมพิวเตอร์", items: "โน๊ตบุ๊คตัดต่อ, โปรเจคเตอร์" },
];

export const CONTACTS = [
    { name: "งานสื่อการเรียนการสอน", position: "ตึก 4 ชั้น 2" },
    { name: "งานประชาสัมพันธ์", position: "ตึก 1" },
];
