
// ─────────────────────────────────────────────────────────────────────────────
//  myBookingsStorage.ts — จำไว้ว่าการจองห้องรายการไหนเป็นของผู้ใช้เครื่องนี้
// ─────────────────────────────────────────────────────────────────────────────
//  แอปนี้ไม่มีระบบ login ผู้ใช้ทั่วไป จึงใช้ localStorage ของเบราว์เซอร์จำ ID
//  (หรือ groupId ถ้าเป็นการจองแบบหลายห้อง/หลายวัน) ของรายการที่ผู้ใช้เครื่องนี้
//  เป็นคนจองเอง เพื่อให้กลับมาแก้ไข/ยกเลิกการจองของตัวเองได้
//  ⚠️  ใช้ได้เฉพาะเบราว์เซอร์/เครื่องเดียวกับตอนจองเท่านั้น
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'myBookingIds';

export const getMyBookingIds = (): string[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const ids = raw ? JSON.parse(raw) : [];
        return Array.isArray(ids) ? ids : [];
    } catch (e) {
        return [];
    }
};

export const addMyBookingId = (id: string): void => {
    try {
        const ids = getMyBookingIds();
        if (!ids.includes(id)) {
            ids.push(id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
        }
    } catch (e) {
        // localStorage อาจใช้ไม่ได้ (เช่น โหมด Private Browsing) — ไม่ต้อง throw ปล่อยผ่านไป
    }
};
