// โครงสร้างโค้ดและระบบเชื่อมต่อทั้งหมด การแก้ไขในอนาคตจะต้องไม่กระทบต่อระบบเดิม โดยมีรายละเอียดดังนี้ครับ:
// 1. Cloudflare Worker (cloudflare-worker.js): ทำหน้าที่เป็น Backend จัดการข้อมูลใน KV Storage และเป็น Proxy ในการส่งการแจ้งเตือนไปยัง LINE Messaging API
//
// 2. LINE Notification System:
//  - ฝั่ง Frontend ใช้ services/notificationService.ts ในการเรียก API
//  - ฝั่ง Worker ใช้ CHANNEL_ACCESS_TOKEN และ RECIPIENT_ID ในการส่ง Push Message
//
// 3. Data Integration (services/apiService.ts): ระบบดึงและบันทึกข้อมูล (ห้องประชุมและอุปกรณ์) ผ่าน Worker Endpoint ทั้งหมด
//
// 4. Configuration (constants.ts): มีการกำหนด WORKER_BASE_URL และ NOTIFICATION_URL ไว้อย่างชัดเจน
//
// ต้องระมัดระวังเป็นพิเศษในการรักษาการเชื่อมต่อเหล่านี้ (โดยเฉพาะ WORKER_BASE_URL ใน constants.ts) และจะไม่แก้ไขส่วนของ Worker หรือ Service ที่เกี่ยวข้องหากไม่มีความจำเป็น เพื่อให้ระบบการแชร์เว็บและการแจ้งเตือนทำงานได้ตามปกติ
//
// --- ข้อควรระวังเพิ่มเติม ---
// 5. ความสอดคล้องของข้อมูล (Data Consistency):
//    หากมีการเปลี่ยนโครงสร้างข้อมูล (Types) ใน Frontend ต้องตรวจสอบฟังก์ชัน 'scheduled' ใน cloudflare-worker.js ด้วย 
//    เพราะ Worker มีการดึงข้อมูลจาก KV มาประมวลผลสรุปรายวัน หากโครงสร้างไม่ตรงกันระบบสรุปผลอาจค้างหรือ Error
//
// 6. การตั้งค่า Environment Variables ใน Cloudflare:
//    ต้องมั่นใจว่าใน Dashboard ของ Cloudflare Worker มีการตั้งค่าตัวแปรเหล่านี้ครบถ้วน:
//    - CHANNEL_ACCESS_TOKEN (สำหรับ LINE API)
//    - RECIPIENT_ID (ID ผู้รับแจ้งเตือน)
//    - ROOM_BOOKINGS_KV (Binding ของ KV ห้องประชุม)
//    - EQUIPMENT_BORROWINGS_KV (Binding ของ KV อุปกรณ์)
//
// 7. ระบบความปลอดภัยเจ้าหน้าที่ (Admin Security):
//    รหัสผ่านใน constants.ts (STAFF_PASSWORDS) เป็นการตรวจสอบฝั่ง Client-side เท่านั้น 
//    ควรระมัดระวังในการแก้ไขหรือเปิดเผยไฟล์นี้ และรหัสผ่านควรมีความซับซ้อนพอสมควร
//
// 8. การจัดการ CORS:
//    ปัจจุบัน Worker ตั้งค่า 'Access-Control-Allow-Origin': '*' เพื่อให้พัฒนาได้สะดวก 
//    หากในอนาคตต้องการความปลอดภัยสูงขึ้น ต้องระบุ Domain ของ Pages (APP_URL) แทนเครื่องหมาย *
