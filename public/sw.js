/**
 * Service Worker แบบผ่านตรง (network pass-through)
 *
 * มีไว้เพื่อให้เบราว์เซอร์ (โดยเฉพาะ Chrome บน Android) ถือว่าเว็บนี้
 * "ติดตั้งได้" และแสดงปุ่มเพิ่มลงหน้าจอหลัก/ติดตั้งแอป
 *
 * ตั้งใจ "ไม่แคช" ไฟล์ใดๆ เพราะระบบนี้ดึงข้อมูลสดจาก Worker ตลอดเวลา
 * การแคชจะทำให้ผู้ใช้เห็นข้อมูลหรือหน้าเว็บเวอร์ชันเก่าโดยไม่รู้ตัว
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // ส่งต่อไปยังเครือข่ายตามปกติ ไม่แตะต้องผลลัพธ์
  event.respondWith(fetch(event.request));
});
