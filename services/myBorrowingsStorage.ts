
// ─────────────────────────────────────────────────────────────────────────────
//  myBorrowingsStorage.ts — จำไว้ว่าคำขอยืมอุปกรณ์รายการไหนเป็นของผู้ใช้เครื่องนี้
// ─────────────────────────────────────────────────────────────────────────────
//  แอปนี้ไม่มีระบบ login ผู้ใช้ทั่วไป จึงใช้ localStorage ของเบราว์เซอร์จำ ID
//  ของรายการที่ผู้ใช้เครื่องนี้เป็นคนส่งเอง เพื่อให้กลับมาแก้ไขคำขอของตัวเองได้
//  ⚠️  ใช้ได้เฉพาะเบราว์เซอร์/เครื่องเดียวกับตอนส่งฟอร์มเท่านั้น
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'myBorrowingIds';

export const getMyBorrowingIds = (): string[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const ids = raw ? JSON.parse(raw) : [];
        return Array.isArray(ids) ? ids : [];
    } catch (e) {
        return [];
    }
};

export const addMyBorrowingId = (id: string): void => {
    try {
        const ids = getMyBorrowingIds();
        if (!ids.includes(id)) {
            ids.push(id);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
        }
    } catch (e) {
        // localStorage อาจใช้ไม่ได้ (เช่น โหมด Private Browsing) — ไม่ต้อง throw ปล่อยผ่านไป
    }
};
