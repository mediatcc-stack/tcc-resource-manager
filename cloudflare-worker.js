/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  TCC LINE NOTIFIER — Cloudflare Worker (Backend หลักของระบบทั้งหมด)
 *  วิทยาลัยพณิชยการธนบุรี — งานสื่อการเรียนการสอน
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  📁 SOURCE CODE (GitHub)
 *  ─────────────────────────────────────────────────────────────────────────────
 *  Repository  : https://github.com/[your-org]/tcc-resource-manager
 *  Branch หลัก  : main
 *  ไฟล์นี้      : cloudflare-worker.js  (deploy แยกต่างหากจาก frontend)
 *  Frontend    : /  (React + Vite — deploy บน Cloudflare Pages)
 *  Worker นี้   : /cloudflare-worker.js (deploy บน Cloudflare Workers)
 *
 *  วิธี commit และ push ไป GitHub:
 *    git add cloudflare-worker.js
 *    git commit -m "fix: อธิบายสิ่งที่แก้"
 *    git push origin main
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🗄️  ฐานข้อมูล — Cloudflare KV  (⚠️ ห้ามลบ KV namespace เด็ดขาด!)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ข้อมูลทั้งหมดเก็บใน Cloudflare KV Storage (ไม่ใช่ SQL — เป็น key-value)
 *  ไม่มีการ backup อัตโนมัติ ถ้าลบ namespace จะหายถาวร!
 *
 *  KV Namespace ที่ใช้งาน (ดูได้ที่ Cloudflare Dashboard → Workers KV):
 *  ┌─────────────────────────────────────────────────────────────────────────┐
 *  │  Binding Name              → KV Namespace (ใน Dashboard)               │
 *  │  ROOM_BOOKINGS_KV          → TCC_ROOM_BOOKINGS                         │
 *  │  EQUIPMENT_BORROWINGS_KV   → TCC_EQUIPMENT_BORROWINGS                  │
 *  │  REPAIR_REQUESTS_KV        → TCC_REPAIR_REQUESTS                       │
 *  └─────────────────────────────────────────────────────────────────────────┘
 *
 *  Key ที่เก็บข้อมูลจริงภายใน KV:
 *    "rooms_data"       → JSON array ของ Booking[] (การจองห้องทั้งหมด)
 *    "equipment_data"   → JSON array ของ BorrowingRequest[] (การยืมอุปกรณ์)
 *    "repairs_data"     → JSON array ของ RepairRequest[] (การแจ้งซ่อมอุปกรณ์ไอที)
 *    "recipient:<id>"   → "1" ต่อผู้รับแจ้งเตือน 1 คน/กลุ่ม (v2.3 ขึ้นไป — ดูหัวข้อ
 *                          ระบบแจ้งเตือน LINE ด้านล่าง)
 *    "recipient_ids"    → (เดิม, ก่อน v2.3) JSON array ของ LINE User ID ที่รับแจ้งเตือน
 *                          — เก็บไว้เป็น legacy สำหรับ migrate ครั้งแรกเท่านั้น
 *
 *  วิธีดูข้อมูลใน KV:
 *    Cloudflare Dashboard → Workers & Pages → KV
 *    → คลิก TCC_ROOM_BOOKINGS → ค้นหา "rooms_data"
 *
 *  ⚠️  วิธี Backup ข้อมูลด้วยตัวเอง (ทำเป็นประจำ):
 *    เปิด URL: https://tcc-line-notifier.media-tcc.workers.dev/data?type=rooms
 *    ใส่ Header: X-API-Key: [API_SECRET_KEY ใน Settings]
 *    Copy JSON ที่ได้ไปเก็บไว้ใน Google Drive หรือ Sheets
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🔔  ระบบแจ้งเตือน LINE  (LINE Messaging API)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ภาพรวมการทำงาน:
 *
 *    [ผู้ใช้จองห้อง]
 *         │
 *         ▼
 *    [Frontend React]  ──POST /notify──▶  [Worker นี้]
 *         │                                     │
 *         │                                     ▼
 *         │                          [LINE Messaging API]
 *         │                         POST /v2/bot/message/push
 *         │                                     │
 *         │                                     ▼
 *         │                          [LINE ของเจ้าหน้าที่]
 *         ▼                          (ทุกกลุ่มใน recipient:<groupId>)
 *    [แสดง Toast สำเร็จ]
 *
 *  วิธีเพิ่มกลุ่มใหม่ให้รับแจ้งเตือน (เก็บเฉพาะกลุ่มเท่านั้น ไม่เก็บ User ส่วนตัว):
 *    1. เชิญ LINE Official Account ของระบบเข้ากลุ่มที่ต้องการ
 *    2. Bot จะรับ Webhook event "join" อัตโนมัติ
 *    3. Worker จะบันทึกเป็น KV key "recipient:<groupId>" ให้เอง (v2.3 ขึ้นไป)
 *    หรือเพิ่มด้วยตัวเองได้ที่ KV → สร้าง key ใหม่ชื่อ "recipient:<Group ID>" ค่า "1"
 *    ค่าใน key = สถานะ: "1"/"on" รับแจ้งเตือน, "off" ปิดเอง, "left:<เวลา>" บอทออกจากกลุ่มแล้ว
 *    (บอทออกจากกลุ่มจะไม่ลบ key ทิ้ง แค่เปลี่ยนค่า — Group ID จึงยังอยู่ให้ก็อปไปใช้ต่อได้)
 *    (การแอดเพื่อนบอทแบบคนเดียว "follow" จะไม่ถูกบันทึกเป็นผู้รับแจ้งเตือนอีกต่อไป)
 *
 *  ⚠️  ตั้งแต่ v2.3 เปลี่ยนจากเก็บเป็น array ก้อนเดียวใน "recipient_ids" มาเป็น
 *      1 key ต่อ 1 ผู้รับ (ดูเหตุผลที่ getRecipientIds() ในโค้ด) — ข้อมูลเก่าจะถูก
 *      migrate มาเป็น key แยกให้อัตโนมัติครั้งแรกที่มีการเรียกใช้งาน ไม่ต้องทำอะไรเพิ่ม
 *
 *  LINE Console (ดูและแก้ไข Channel):
 *    https://developers.line.biz/console/
 *    Channel ที่ใช้: ดูชื่อ Channel จาก CHANNEL_ACCESS_TOKEN ใน Settings
 *
 *  แจ้งเตือนอัตโนมัติทุกเช้า (Scheduled):
 *    Worker มี scheduled() handler ที่ส่งสรุปการจองวันนี้ทุกวัน
 *    ตั้งเวลาได้ที่: Cloudflare Dashboard → Worker → Settings → Triggers → Cron
 *    แนะนำ: "0 1 * * *"  (ตี 1 UTC = 8:00 น. ไทย)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🔐  Environment Variables (ตั้งค่าใน Cloudflare Dashboard → Settings)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️  ห้าม hardcode ค่าเหล่านี้ในโค้ด — ต้องตั้งผ่าน Dashboard เท่านั้น
 *  ⚠️  ถ้า CHANNEL_ACCESS_TOKEN หมดอายุ ให้ออก Token ใหม่จาก LINE Console
 *
 *  ┌──────────────────────────┬────────────────────────────────────────────────┐
 *  │  ชื่อตัวแปร              │  ใช้ทำอะไร                                    │
 *  ├──────────────────────────┼────────────────────────────────────────────────┤
 *  │  ADMIN_PASSWORD          │  รหัสผ่านสำหรับโหมดเจ้าหน้าที่              │
 *  │  API_SECRET_KEY          │  Key สำหรับ Frontend เรียก Worker (/data)     │
 *  │                          │  ต้องตรงกับ VITE_API_SECRET_KEY ใน Pages     │
 *  │  CHANNEL_ACCESS_TOKEN    │  LINE Bot Long-lived Token (ส่ง Push message) │
 *  │  CHANNEL_SECRET          │  LINE Channel Secret — ใช้ตรวจลายเซ็น         │
 *  │                          │  /webhook (⚠️ ต้องตั้ง! ถ้าไม่ตั้ง ใครก็ยิง     │
 *  │                          │  event ปลอมมาแอบเพิ่มกลุ่มตัวเองเป็นผู้รับ     │
 *  │                          │  แจ้งเตือนได้ — ดูที่ verifyLineSignature)     │
 *  │  RECIPIENT_ID            │  LINE User ID สำรอง (ถ้า KV ว่าง)            │
 *  │  REPAIR_GROUP_ID         │  LINE Group ID เฉพาะสำหรับแจ้งซ่อม           │
 *  │                          │  (แจ้งเตือน /notify?target=repair จะส่ง      │
 *  │                          │  เข้ากลุ่มนี้เท่านั้น ไม่ส่งเข้า recipient ทั่วไป)│
 *  └──────────────────────────┴────────────────────────────────────────────────┘
 *
 *  ถ้าต้องการเปลี่ยนรหัสผ่าน Admin:
 *    Dashboard → Settings → Edit → ADMIN_PASSWORD → บันทึก → Deploy ใหม่
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🚀  การ Deploy Worker
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  วิธีที่ 1 — ผ่าน Cloudflare Dashboard (ง่ายที่สุด):
 *    Dashboard → tcc-line-notifier → Edit code → วาง code → Deploy
 *
 *  วิธีที่ 2 — ผ่าน Wrangler CLI (สำหรับ developer):
 *    npm install -g wrangler
 *    wrangler login
 *    wrangler deploy cloudflare-worker.js --name tcc-line-notifier
 *
 *  ⚠️  หลัง deploy ต้องทดสอบทันที:
 *    GET https://tcc-line-notifier.media-tcc.workers.dev/status
 *    ต้องได้ { lineApiToken: true, roomKvBinding: true, ... }
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  📡  API Endpoints ทั้งหมด
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  PUBLIC (ไม่ต้องใช้ API Key):
 *    GET  /status          → ตรวจสอบว่า Worker พร้อมทำงานหรือไม่
 *    POST /auth/login      → Body: { password } → ตรวจสอบรหัส Admin
 *    POST /webhook         → รับ event จาก LINE (เพิ่ม recipient อัตโนมัติ +
 *                            @Mention Handler: ตอบรายงานผ่าน Reply Token ไม่กิน Push
 *                            quota — พิมพ์ "@Bot ยืม" (อุปกรณ์ค้างคืน), "@Bot ซ่อม"
 *                            (แจ้งซ่อมค้าง), "@Bot รายงาน/จอง..." (จองห้อง) ในกลุ่ม)
 *
 *  PROTECTED (ต้องใส่ Header: X-API-Key):
 *    GET  /data?type=rooms      → ดึงข้อมูลการจองห้องทั้งหมด
 *    GET  /data?type=rooms&version=prev → ดึง "สำเนาก่อนการบันทึกครั้งล่าสุด" (กู้ข้อมูล)
 *      ↳ GET ส่ง header X-Data-Version กลับไปด้วย, POST ควรแนบกลับมา
 *        ถ้าเลขไม่ตรง = มีคนบันทึกแทรก → ตอบ 409 { version, data } ให้เอาไปรวมแล้วส่งใหม่
 *    POST /data?type=rooms      → บันทึกข้อมูลการจองห้องทั้งหมด (overwrite)
 *    GET  /data?type=equipment  → ดึงข้อมูลการยืมอุปกรณ์ทั้งหมด
 *    POST /data?type=equipment  → บันทึกข้อมูลการยืมอุปกรณ์ทั้งหมด (overwrite)
 *    GET  /data?type=repairs    → ดึงข้อมูลการแจ้งซ่อมอุปกรณ์ไอทีทั้งหมด
 *    POST /data?type=repairs    → บันทึกข้อมูลการแจ้งซ่อมอุปกรณ์ไอทีทั้งหมด (overwrite)
 *    POST /notify               → Body: { message, target? } → ส่ง LINE แจ้งเตือน
 *                                  target: "repair" → ส่งเข้าเฉพาะกลุ่ม REPAIR_GROUP_ID
 *                                  ไม่ระบุ → ส่งเข้า recipient ทั่วไปทุกคน (จองห้อง)
 *                                  ตอบกลับ { success, sent, failed, total, error? }
 *                                  success = false เมื่อส่งไม่ถึงสักปลายทาง
 *    GET  /recipients           → ดูรายชื่อผู้รับแจ้งเตือน
 *                                  [{ id, name, type, active, status }]
 *                                  name ดึงสดจาก LINE API ทุกครั้ง (ไม่แคช)
 *                                  active: false = หยุดรับแล้วแต่ยังเก็บ Group ID ไว้
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🛠️  แก้ไขล่าสุด
 * ═══════════════════════════════════════════════════════════════════════════════
 *  v2.10 (2026-09-09) — บอทออกจากกลุ่มแล้ว "ไม่ลบ key ทิ้ง" แค่เปลี่ยนค่าเป็น
 *                       left:<เวลา> เพื่อให้ Group ID ยังอยู่ให้ก็อปไปใช้ต่อ
 *                       (เช่น เอาไปใส่ REPAIR_GROUP_ID) เชิญบอทกลับเข้ากลุ่มเดิม
 *                       ค่าจะกลับเป็น "1" เอง / ปิดรับเองด้วยการแก้ค่าเป็น "off" ได้
 *                       /recipients คืนกลุ่มที่หยุดรับแล้วมาด้วย (active: false)
 *  v2.9 (2026-09-09) — กันข้อมูลหายเมื่อหลายคนใช้พร้อมกัน + จำกัดการเดารหัส
 *                       • /data ใช้ระบบเลขรุ่น (X-Data-Version): GET ส่งเลขรุ่นกลับไป
 *                         POST แนบกลับมา ถ้าไม่ตรง = มีคนบันทึกแทรก → ตอบ 409 พร้อมข้อมูล
 *                         ล่าสุด ให้ฝั่งเว็บรวมข้อมูลแล้วส่งใหม่ (เดิม last-write-wins
 *                         ของคนที่บันทึกก่อนหายทั้งก้อนโดยไม่มีใครรู้)
 *                         ไม่แนบเลขรุ่นมาก็ยังบันทึกได้ frontend รุ่นเก่าจึงไม่พัง
 *                       • /auth/login จำกัด 10 ครั้ง/IP/15 นาที (เดิมเดาได้ไม่จำกัด)
 *                       • เพิ่ม Access-Control-Expose-Headers ไม่งั้นเบราว์เซอร์อ่าน
 *                         X-Data-Version ไม่ได้ ระบบกันชนจะเงียบไปเฉย ๆ
 *  v2.8 (2026-09-09) — รอบตรวจความน่าเชื่อถือของการแจ้งเตือนและความปลอดภัย
 *                       • /webhook ตรวจลายเซ็น x-line-signature ด้วย CHANNEL_SECRET
 *                         (ปิดช่องที่ใครก็ยิง event "join" ปลอมมาแอบเป็นผู้รับแจ้งเตือนได้)
 *                         ถ้ายังไม่ได้ตั้ง CHANNEL_SECRET จะยังทำงานเหมือนเดิมแต่ขึ้น warning
 *                       • /notify รอผลจาก LINE จริงแล้วตอบ { sent, failed, total }
 *                         หน้าเว็บจึงไม่ขึ้น "ส่งสำเร็จ" ทั้งที่ push ล้มเหลวทุกปลายทางอีกต่อไป
 *                       • push ที่ล้มเหลวชั่วคราว (429 โควตาเต็ม / 5xx) ลองใหม่ 3 ครั้ง
 *                         แบบถอยเวลา และลบผู้รับที่ตอบ 403 (ถูกเตะออกจากกลุ่ม) ทิ้งอัตโนมัติ
 *                       • ข้อความยาวเกิน 5,000 ตัวอักษรถูกตัดเป็นหลายข้อความ
 *                         (เดิม LINE ตอบ 400 แล้วสรุปทั้งก้อนหายเงียบ ๆ)
 *                       • POST /data ปฏิเสธ body ที่ไม่ใช่ array และเก็บสำเนาก่อนหน้าไว้ที่
 *                         <type>_data_prev เรียกคืนได้ที่ /data?type=...&version=prev
 *                       • scheduled() ใช้วันที่ตามเวลาไทย (เดิมใช้ UTC — เพี้ยนถ้าเปลี่ยนเวลา cron)
 *                       • @mention ที่ไม่ตรงคำสั่งไหน ตอบวิธีใช้กลับไป (เดิมบอทเงียบ)
 *                       • /status บอก channelSecretSet และ recipientCount เพิ่ม
 *  v2.7 (2026-08-03) — /recipients คืนชื่อกลุ่ม/ชื่อผู้ใช้จริงคู่กับ ID (ดึงสดจาก
 *                       LINE Group Summary / Profile API ทุกครั้งที่เรียก ไม่แคช
 *                       ไว้ที่ไหน จึงเห็นชื่อล่าสุดเสมอแม้มีคนเปลี่ยนชื่อกลุ่มทีหลัง)
 *  v2.6 (2026-08-03) — เพิ่มคำสั่ง @Mention "ยืม" และ "ซ่อม" ให้เรียกรายงานอุปกรณ์
 *                       ค้างคืน / แจ้งซ่อมค้างผ่าน Reply ได้เหมือนระบบจองห้อง
 *                       (เผื่อ Push token ของบอทหมดโควต้า ยังเรียกดูรายงานเองได้)
 *  v2.5 (2026-08-03) — Webhook เก็บเฉพาะ Group ID (event "join") เป็นผู้รับแจ้งเตือน
 *                       ทั่วไปเท่านั้น ตัด event "follow"/"unfollow" ออก (ไม่เก็บ User ID
 *                       ส่วนตัวที่แอดเพื่อนบอทเดี่ยวๆ อีกต่อไป)
 *  v2.4 (2026-08-03) — ตัดการแจ้งเตือน LINE ออกจากระบบยืมอุปกรณ์ (ใช้เป็นแค่สมุด
 *                       บันทึกในระบบ ไม่ต้องแจ้งเตือนแล้ว), เพิ่ม target: "repair"
 *                       ใน /notify ให้แจ้งซ่อมส่งเข้าเฉพาะกลุ่ม REPAIR_GROUP_ID
 *                       แยกจาก recipient ทั่วไปที่ใช้กับระบบจองห้อง
 *  v2.3 (2026-08-01) — แก้บั๊ก race condition ที่ recipient_ids (array ก้อนเดียว)
 *                       ถูกเขียนทับกันเวลามีหลาย webhook event (join/leave/follow/
 *                       unfollow) เข้ามาพร้อมกัน ทำให้ผู้รับแจ้งเตือนบางคนหายไป
 *                       เงียบๆ โดยไม่มี error — เปลี่ยนมาเก็บเป็น 1 key ต่อ 1 ผู้รับ
 *                       (recipient:<id>) พร้อม migrate ข้อมูลเก่าอัตโนมัติ
 *  v2.2 (2026-08-01) — เพิ่มระบบแจ้งซ่อมอุปกรณ์ไอที (/data?type=repairs),
 *                       เพิ่ม KV Namespace REPAIR_REQUESTS_KV และ repairKvBinding
 *                       ใน /status
 *  v2.1 (2026-07-20) — ปรับ parseDate() ใน @mention handler ให้รองรับ
 *                       รูปแบบวันที่แบบชื่อเดือนไทย (เต็ม/ย่อ มีจุด/ไม่มีจุด)
 *                       และปีทั้ง พ.ศ. 2 หลัก / พ.ศ. 4 หลัก / ค.ศ. 4 หลัก
 *  v2.0 (2026-05-20) — แยก public/protected routes ชัดเจน,
 *                       แก้ bug checkKvBinding เรียกซ้ำ,
 *                       เพิ่ม /webhook สำหรับเพิ่ม recipient อัตโนมัติ,
 *                       เพิ่ม scheduled() สรุปการจองประจำวัน
 *  v1.0 (2025-??-??)  — เวอร์ชันแรก
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
//  CORS Headers — อนุญาตให้ Frontend (Cloudflare Pages) เรียก API ได้
//  ถ้าต้องการจำกัดให้เรียกได้แค่จาก domain ของเราเท่านั้น ให้เปลี่ยน '*'
//  เป็น 'https://tcc-media-booking.pages.dev'
// ─────────────────────────────────────────────────────────────────────────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-API-Key, X-Data-Version',
  // เบราว์เซอร์จะไม่ยอมให้ JS อ่าน header ที่ไม่ใช่ header มาตรฐาน ถ้าไม่ประกาศตรงนี้
  // ถ้าลืมบรรทัดนี้ ฝั่งเว็บจะอ่าน X-Data-Version ไม่ได้ → ระบบกันข้อมูลชนกันจะเงียบไปเฉย ๆ
  'Access-Control-Expose-Headers': 'X-Data-Version',
};

// ─────────────────────────────────────────────────────────────────────────────
//  ระบบเก็บรายชื่อผู้รับแจ้งเตือน — 1 key ต่อ 1 ผู้รับ (recipient:<id>)
// ─────────────────────────────────────────────────────────────────────────────
//  เดิมเก็บเป็น array ก้อนเดียวใน key "recipient_ids" ซึ่งต้องอ่านทั้งก้อน
//  มาแก้ไขแล้วเขียนทับทั้งก้อนกลับไปทุกครั้ง (read-modify-write) — ถ้ามีหลาย
//  webhook event (เช่น 2 กลุ่ม join ไล่เลี่ยกัน) เข้ามาพร้อมกัน คำเขียนที่มาทีหลัง
//  จะเขียนทับคำเขียนก่อนหน้าทั้งหมด ทำให้ ID ที่เพิ่งเพิ่มไปหายเงียบๆ โดยไม่มี error
//
//  ตอนนี้เปลี่ยนมาเก็บทีละ key แยกกัน (recipient:<id>) แต่ละ webhook event
//  จะเขียนแค่ key ของตัวเอง ไม่มีทางไปทับ ID อื่นได้อีก ไม่ว่าจะมีกี่ event
//  เข้ามาพร้อมกันก็ตาม — ใช้ namespace เดิม (ROOM_BOOKINGS_KV) ไม่ต้องเพิ่ม
//  binding ใหม่ใน Cloudflare
//
//  ค่าใน key บอกว่ากลุ่มนั้นยังรับแจ้งเตือนอยู่ไหม (แก้ด้วยมือใน Dashboard ได้เลย)
//    "1"  หรือ "on"   → รับแจ้งเตือน
//    "off"            → ปิดชั่วคราวเอง (บอทยังอยู่ในกลุ่ม แต่ไม่ส่งหา)
//    "left:<เวลา>"    → บอทไม่ได้อยู่ในกลุ่มแล้ว (ถูกเตะออก/ออกเอง)
//
//  ⚠️ ตอนบอทออกจากกลุ่ม ระบบจะ "เก็บ key ไว้แล้วเปลี่ยนค่าเป็น left:" ไม่ลบทิ้ง
//     เพื่อให้ Group ID ยังอยู่ให้ก็อปไปใช้ทีหลังได้ (เช่น เอาไปใส่ REPAIR_GROUP_ID)
//     ถ้าเชิญบอทกลับเข้ากลุ่มเดิม ค่าจะกลับเป็น "1" ให้เอง
//
//  getRecipientIds() จะ migrate ข้อมูลเก่าใน "recipient_ids" มาเป็น key แยก
//  ให้อัตโนมัติครั้งแรกที่เรียก (ถ้ายังไม่เคย migrate) — ไม่ต้องเพิ่มเพื่อนบอทใหม่
// ─────────────────────────────────────────────────────────────────────────────
const RECIPIENT_PREFIX = 'recipient:';
/** จำกัดการเดารหัสผ่านแอดมิน: กี่ครั้งต่อ IP ภายในกี่วินาที */
const LOGIN_MAX_ATTEMPTS = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;
/** key ที่บอกว่า migrate ข้อมูลผู้รับแบบเก่า (recipient_ids) มาแล้ว — กันข้อมูลเก่าฟื้นคืนชีพ */
const LEGACY_MIGRATED_KEY = 'recipient_ids_migrated';

// ─────────────────────────────────────────────────────────────────────────────
//  Helper รวม — ใช้ซ้ำทั้งไฟล์
// ─────────────────────────────────────────────────────────────────────────────

/** สร้าง JSON Response พร้อม CORS header (ใช้แทนการเขียนซ้ำทุกจุด) */
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * เวลาปัจจุบันตามเขตเวลาไทย
 * Worker รันด้วย UTC เสมอ ถ้าใช้ new Date() ตรง ๆ วันที่จะเพี้ยนช่วงหัวค่ำถึงเที่ยงคืน
 * (เช่น 21:00 น. ของไทย = 14:00 UTC วันเดียวกัน แต่ 07:00 น. ไทย = 00:00 UTC วันเดียวกัน
 *  ส่วน 01:00 น. ไทย = 18:00 UTC ของ "เมื่อวาน") — จึงต้องบวก 7 ชม. แล้วอ่านด้วย getUTC*
 */
const bangkokNow = () => new Date(Date.now() + 7 * 60 * 60 * 1000);

/** วันที่ของไทยในรูปแบบ YYYY-MM-DD (ตรงกับรูปแบบที่ frontend บันทึกไว้) */
const bangkokDateISO = (d = bangkokNow()) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

/**
 * ตัดข้อความยาวให้อยู่ในลิมิตของ LINE (ข้อความละไม่เกิน 5,000 ตัวอักษร)
 * ตัดตามบรรทัดเพื่อไม่ให้ข้อความขาดกลางคำ — คืนเป็น array ของข้อความที่ส่งได้จริง
 * (เดิมถ้าสรุปรายวันยาวเกิน LINE จะตอบ 400 แล้วข้อความ "หายทั้งก้อน" โดยไม่มีใครรู้)
 */
const splitMessage = (text, maxLength = 4800) => {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    // บรรทัดเดียวยาวเกินลิมิต — จำใจตัดกลางบรรทัด
    if (line.length > maxLength) {
      if (current) { chunks.push(current); current = ''; }
      for (let i = 0; i < line.length; i += maxLength) chunks.push(line.slice(i, i + maxLength));
      continue;
    }
    if (current.length + line.length + 1 > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);

  // LINE ส่งได้ครั้งละไม่เกิน 5 ข้อความ
  return chunks.slice(0, 5);
};

/**
 * ตรวจลายเซ็นของ Webhook จาก LINE (HMAC-SHA256 ของ body ดิบ ด้วย CHANNEL_SECRET)
 *
 * ⚠️  สำคัญมาก: ถ้าไม่ตรวจ ใครก็ตามที่รู้ URL ของ /webhook สามารถยิง event ปลอม
 *     เช่น {"events":[{"type":"join","source":{"groupId":"C..."}}]} เพื่อแอบเพิ่ม
 *     กลุ่มตัวเองเป็นผู้รับแจ้งเตือน แล้วจะได้รับข้อมูลการจอง (ชื่อผู้จอง/หัวข้อประชุม)
 *     ทั้งหมดของหน่วยงานไปเรื่อย ๆ โดยไม่มีใครรู้
 */
async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    if (expected.length !== signature.length) return false;
    // เทียบแบบเวลาคงที่ กันการเดาลายเซ็นจากเวลาที่ใช้เปรียบเทียบ
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  } catch (e) {
    console.error(`[Webhook] Signature verification error: ${e.message}`);
    return false;
  }
}

/** true = ค่านี้แปลว่ากลุ่มยังรับแจ้งเตือนอยู่ (ค่าเก่า "1" และค่าว่างถือว่ารับ) */
const isActiveRecipientValue = (value) => {
  if (value === null || value === undefined) return true;
  const normalized = String(value).trim().toLowerCase();
  return !(normalized.startsWith('left') || normalized === 'off' || normalized === '0' || normalized === 'false');
};

/**
 * รายชื่อผู้รับแจ้งเตือนทั้งหมดพร้อมสถานะ — [{ id, active, value }]
 * อ่านค่าของทุก key ด้วย (ไม่กี่ key) เพื่อให้แก้สถานะด้วยมือใน Dashboard แล้วมีผลจริง
 */
async function listRecipients(env) {
  const list = await env.ROOM_BOOKINGS_KV.list({ prefix: RECIPIENT_PREFIX });
  return Promise.all(list.keys.map(async (key) => {
    const id = key.name.slice(RECIPIENT_PREFIX.length);
    const value = await env.ROOM_BOOKINGS_KV.get(key.name);
    return { id, value, active: isActiveRecipientValue(value) };
  }));
}

async function getRecipientIds(env) {
  const recipients = await listRecipients(env);
  if (recipients.length > 0) {
    return recipients.filter(r => r.active).map(r => r.id);
  }

  // ยังไม่เคย migrate — ลองอ่านของเก่า (recipient_ids array) มาย้ายเป็น key แยกให้ครั้งเดียว
  // เช็ค flag ก่อน เพราะถ้าย้ายแล้วและผู้รับถูกลบออกภายหลังจนหมด (บอทออกจากทุกกลุ่ม)
  // การอ่านของเก่าซ้ำจะทำให้กลุ่มที่เอาออกไปแล้วกลับมาได้รับแจ้งเตือนอีก
  const alreadyMigrated = await env.ROOM_BOOKINGS_KV.get(LEGACY_MIGRATED_KEY);
  if (alreadyMigrated) return [];

  const legacyIds = await env.ROOM_BOOKINGS_KV.get('recipient_ids', 'json') || [];
  if (Array.isArray(legacyIds) && legacyIds.length > 0) {
    await Promise.all(legacyIds.map(id => env.ROOM_BOOKINGS_KV.put(`${RECIPIENT_PREFIX}${id}`, '1')));
    await env.ROOM_BOOKINGS_KV.put(LEGACY_MIGRATED_KEY, new Date().toISOString());
    console.log(`[Migration] Migrated ${legacyIds.length} recipient(s) from legacy "recipient_ids" to per-key storage`);
    return legacyIds;
  }

  await env.ROOM_BOOKINGS_KV.put(LEGACY_MIGRATED_KEY, new Date().toISOString());
  return [];
}

async function addRecipient(env, id) {
  if (!id) return;
  await env.ROOM_BOOKINGS_KV.put(`${RECIPIENT_PREFIX}${id}`, '1');
}

/**
 * หยุดส่งแจ้งเตือนให้ปลายทางนี้ — เก็บ key ไว้ แค่เปลี่ยนค่าเป็น left:<เวลา>
 * (ไม่ลบทิ้ง เพราะ Group ID จำยากและมักต้องเอาไปใช้ต่อ เช่น ใส่ใน REPAIR_GROUP_ID)
 */
async function removeRecipient(env, id, reason = 'left') {
  if (!id) return;
  await env.ROOM_BOOKINGS_KV.put(`${RECIPIENT_PREFIX}${id}`, `${reason}:${new Date().toISOString()}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  ส่งข้อความเข้า LINE — push (ทักเอง) และ reply (ตอบกลับ)
// ─────────────────────────────────────────────────────────────────────────────

/** เรียก LINE API หนึ่งครั้ง แล้วคืนผลแบบอ่านง่าย (ไม่ throw) */
async function callLineApi(env, endpoint, payload) {
  try {
    const response = await fetch(`https://api.line.me/v2/bot/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { ok: true, status: response.status };
    return { ok: false, status: response.status, body: await response.text() };
  } catch (e) {
    return { ok: false, status: 0, body: e.message };
  }
}

/**
 * ส่ง push ไปหาผู้รับหนึ่งราย พร้อมลองใหม่เมื่อเจอปัญหาชั่วคราว
 *   429 = ส่งถี่เกิน/โควตาเดือนเต็ม, 5xx = ฝั่ง LINE มีปัญหา → ลองใหม่ได้
 *   4xx อื่น = ข้อความหรือผู้รับมีปัญหา → ลองใหม่ก็ไม่ช่วย
 */
async function pushWithRetry(env, recipientId, messages, maxAttempts = 3) {
  let result;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result = await callLineApi(env, 'message/push', { to: recipientId, messages });
    if (result.ok) return result;

    const retriable = result.status === 429 || result.status >= 500 || result.status === 0;
    if (!retriable || attempt === maxAttempts) return result;

    await new Promise(resolve => setTimeout(resolve, 400 * 2 ** (attempt - 1))); // 400ms, 800ms
  }
  return result;
}

/**
 * sendNotification(message, env, recipientIdsOverride?)
 * ส่งข้อความ Push ไปหา LINE ของเจ้าหน้าที่ทุกคนใน recipient:<id>
 * ถ้า KV ว่าง จะใช้ RECIPIENT_ID จาก env เป็น fallback
 * ถ้าใส่ recipientIdsOverride มา จะส่งเฉพาะรายชื่อนั้น (ใช้กับ /notify?target=repair)
 *
 * คืนผลสรุปเสมอ { total, sent, failed, errors, removed } — ผู้เรียกจะได้รู้ว่าส่งไม่ถึงใคร
 * (เดิมฟังก์ชันนี้กลืน error ทั้งหมด ทำให้หน้าเว็บขึ้น "ส่งแจ้งเตือนสำเร็จ" ทั้งที่ไม่มีใครได้รับ)
 */
async function sendNotification(message, env, recipientIdsOverride) {
  const messages = splitMessage(message).map(text => ({ type: 'text', text }));
  if (messages.length === 0) {
    return { total: 0, sent: 0, failed: 0, errors: ['empty message'], removed: [] };
  }
  if (!env.CHANNEL_ACCESS_TOKEN) {
    console.error('[LINE Push Error] CHANNEL_ACCESS_TOKEN not configured.');
    return { total: 0, sent: 0, failed: 0, errors: ['CHANNEL_ACCESS_TOKEN not configured'], removed: [] };
  }

  let recipientIds = recipientIdsOverride;
  if (!recipientIds) {
    try {
      recipientIds = await getRecipientIds(env);
    } catch (e) {
      console.error(`[LINE Push Error] Cannot read recipients: ${e.message}`);
      recipientIds = [];
    }
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      if (env.RECIPIENT_ID) {
        recipientIds = [env.RECIPIENT_ID];
      } else {
        console.error('[LINE Push Error] No recipients found.');
        return { total: 0, sent: 0, failed: 0, errors: ['no recipients'], removed: [] };
      }
    }
  }

  const results = await Promise.all(recipientIds.map(async (recipientId) => {
    const result = await pushWithRetry(env, recipientId, messages);
    if (result.ok) return { recipientId, ok: true };

    console.error(`[LINE Push Error] To: ${recipientId}, Status: ${result.status}, Body: ${result.body}`);

    // 403 = บอทส่งหาปลายทางนี้ไม่ได้แล้ว (ถูกเตะออกจากกลุ่ม/กลุ่มถูกยุบ/ผู้ใช้บล็อก)
    // ลบทิ้งอัตโนมัติ เพื่อไม่ให้ค้างเป็นผู้รับที่ส่งไม่เคยสำเร็จไปตลอด
    // (401/400 ไม่ลบ เพราะอาจเป็นปัญหาที่ token หรือรูปแบบข้อความ ไม่ใช่ตัวผู้รับ)
    let removed = false;
    if (result.status === 403 && !recipientIdsOverride) {
      try {
        await removeRecipient(env, recipientId, 'unreachable');
        removed = true;
        console.log(`[LINE Push] Recipient ${recipientId} marked unreachable (key kept for reference)`);
      } catch (e) {
        console.error(`[LINE Push] Failed to remove recipient ${recipientId}: ${e.message}`);
      }
    }
    return { recipientId, ok: false, removed, status: result.status, body: result.body };
  }));

  const failedResults = results.filter(r => !r.ok);
  const summary = {
    total: results.length,
    sent: results.length - failedResults.length,
    failed: failedResults.length,
    errors: failedResults.map(r => `${r.recipientId}: ${r.status === 429 ? 'ส่งไม่ได้ (โควตา/ถี่เกินไป)' : `HTTP ${r.status}`}`),
    removed: failedResults.filter(r => r.removed).map(r => r.recipientId),
  };
  console.log(`[LINE Push] sent=${summary.sent} failed=${summary.failed} total=${summary.total}`);
  return summary;
}

/** ตอบกลับในแชท (ใช้ Reply Token — ไม่กิน Push quota) */
async function replyToLine(env, replyToken, text, logLabel = 'Reply') {
  const messages = splitMessage(text).map(t => ({ type: 'text', text: t }));
  if (messages.length === 0) return { ok: false, status: 0, body: 'empty message' };

  const result = await callLineApi(env, 'message/reply', { replyToken, messages });
  if (!result.ok) {
    console.error(`[Mention] ${logLabel} failed: Status ${result.status}, Body: ${result.body}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  checkKvBinding(kv, name)
//  ตรวจสอบว่า KV Namespace ถูก bind กับ Worker หรือยัง
//  คืนค่า Response ข้อผิดพลาดถ้าไม่พบ, คืน null ถ้าพร้อมใช้งาน
// ─────────────────────────────────────────────────────────────────────────────
const checkKvBinding = (kv, name) => {
  if (!kv) {
    const errorMsg = `KV Namespace binding "${name}" not found.`;
    console.error(`[KV Binding Error] ${errorMsg}`);
    return json({ error: errorMsg }, 500);
  }
  return null;
};

export default {
  // ───────────────────────────────────────────────────────────────────────────
  //  fetch(request, env, ctx)
  //  Handler หลักที่รับทุก HTTP Request
  // ───────────────────────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {

    // Preflight CORS request — browser ส่งมาก่อน cross-origin request จริง
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ── PUBLIC ROUTES (ไม่ต้องการ API Key) ──────────────────────────────────

    // ตรวจสอบสถานะ Worker — Frontend เรียกตอนโหลดหน้าแรก
    if (path === '/status') {
      // นับผู้รับแจ้งเตือนจริงใน KV ด้วย — ถ้าเป็น 0 แปลว่าแจ้งเตือนจะไม่ถึงใครเลย
      let recipientCount = null;
      try {
        recipientCount = (await getRecipientIds(env)).length;
      } catch (e) {
        console.error(`[Status] Cannot count recipients: ${e.message}`);
      }

      return json({
        lineApiToken: !!env.CHANNEL_ACCESS_TOKEN,
        channelSecretSet: !!env.CHANNEL_SECRET,   // ต้องตั้งค่า ไม่งั้น /webhook รับ event ปลอมได้
        roomKvBinding: !!env.ROOM_BOOKINGS_KV,
        equipmentKvBinding: !!env.EQUIPMENT_BORROWINGS_KV,
        repairKvBinding: !!env.REPAIR_REQUESTS_KV,
        recipientIdSet: !!env.RECIPIENT_ID,
        repairGroupIdSet: !!env.REPAIR_GROUP_ID,
        recipientCount,
      });
    }

    // ล็อกอิน Admin — ตรวจสอบรหัสผ่านกับ ADMIN_PASSWORD ใน env
    if (path === '/auth/login' && request.method === 'POST') {
      // จำกัดการเดารหัส: 10 ครั้งต่อ IP ต่อ 15 นาที (เดิมเดาได้ไม่จำกัด)
      const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
      const attemptKey = `login_attempt:${clientIp}`;
      try {
        const attempts = parseInt(await env.ROOM_BOOKINGS_KV.get(attemptKey) || '0', 10);
        if (attempts >= LOGIN_MAX_ATTEMPTS) {
          console.warn(`[Auth] Too many failed logins from ${clientIp}`);
          return json({ success: false, error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาที' }, 429);
        }

        const { password } = await request.json();
        if (password && env.ADMIN_PASSWORD && password === env.ADMIN_PASSWORD) {
          if (attempts > 0) await env.ROOM_BOOKINGS_KV.delete(attemptKey);
          return json({ success: true });
        }

        // นับเฉพาะครั้งที่ผิด และให้ KV ลบ key ทิ้งเองเมื่อครบ 15 นาที
        await env.ROOM_BOOKINGS_KV.put(attemptKey, String(attempts + 1), { expirationTtl: LOGIN_WINDOW_SECONDS });
        return json({ success: false }, 401);
      } catch (e) {
        return json({ success: false }, 400);
      }
    }

    // Webhook จาก LINE — เพิ่ม groupId ลง recipient อัตโนมัติเมื่อบอทถูกเชิญเข้ากลุ่ม
    // (เก็บเฉพาะกลุ่มเท่านั้น ไม่เก็บ User ID ส่วนตัวที่แอดเพื่อนบอทเดี่ยวๆ)
    // LINE เรียก endpoint นี้เอง ไม่ต้องมี API Key
    // ต้องตั้งค่า Webhook URL ที่ LINE Console:
    //   https://tcc-line-notifier.media-tcc.workers.dev/webhook
    if (path === '/webhook' && request.method === 'POST') {
      try {
        // ต้องอ่าน body เป็นข้อความดิบก่อน เพราะลายเซ็นคำนวณจากตัวอักษรทุกตัวที่ LINE ส่งมา
        const rawBody = await request.text();

        if (env.CHANNEL_SECRET) {
          const signature = request.headers.get('x-line-signature');
          const valid = await verifyLineSignature(rawBody, signature, env.CHANNEL_SECRET);
          if (!valid) {
            console.error('[Webhook] Invalid signature — request rejected.');
            return new Response('Invalid signature', { status: 401 });
          }
        } else {
          // ไม่ตั้ง CHANNEL_SECRET = ใครก็ยิง event ปลอมมาแอบเพิ่มกลุ่มตัวเองเป็นผู้รับแจ้งเตือนได้
          console.warn('[Webhook] CHANNEL_SECRET is not set — signature check skipped. โปรดตั้งค่าใน Worker Settings');
        }

        const body = JSON.parse(rawBody);
        const events = body.events || [];
        for (const event of events) {

          if (event.type === 'join') {
            // Bot ถูกเชิญเข้ากลุ่ม → เก็บ groupId
            await addRecipient(env, event.source.groupId);
            console.log(`[Webhook] Saved new recipient: ${event.source.groupId} (type: join)`);
          }

          if (event.type === 'leave') {
            // Bot ถูกเตะออกจากกลุ่ม → ลบ groupId ออกจาก KV อัตโนมัติ
            const removeId = event.source.groupId;
            if (removeId) {
              await removeRecipient(env, removeId, 'left');
              console.log(`[Webhook] Recipient ${removeId} marked as left (key kept for reference)`);
            }
          }

          // ── @Mention Handler ──────────────────────────────────────────────
          // ทริกเกอร์เฉพาะเมื่อมีคน @Bot ในกลุ่มเท่านั้น
          // ใช้ Reply Token → ไม่กิน Push quota เลย
          if (event.type === 'message' && event.message?.type === 'text') {
            const isBotMentioned = event.message.mention?.mentionees?.some(m => m.isSelf === true);

            if (isBotMentioned) {
              const text = event.message.text.toLowerCase();
              // "ขอยืมห้องประชุม" ต้องไปเข้ารายงานการจองห้อง ไม่ใช่รายงานยืมอุปกรณ์
              const asksEquipment = text.includes('ยืม') && !text.includes('ห้อง');

              // คำสั่ง: @Bot ยืม / รายงานยืม → รายงานอุปกรณ์ที่ยังไม่คืน (เผื่อ Push token หมด เรียกดูเองได้)
              if (asksEquipment) {
                const borrowings = await env.EQUIPMENT_BORROWINGS_KV.get('equipment_data', 'json') || [];
                const activeBorrowStatuses = ['รออนุมัติ', 'อยู่ระหว่างการยืม', 'เกินกำหนด'];
                const borrowPriority = { 'เกินกำหนด': 1, 'อยู่ระหว่างการยืม': 2, 'รออนุมัติ': 3 };
                const allActiveBorrowings = borrowings
                  .filter(b => activeBorrowStatuses.includes(b.status))
                  .sort((a, b) => {
                    const orderA = borrowPriority[a.status] || 99;
                    const orderB = borrowPriority[b.status] || 99;
                    if (orderA !== orderB) return orderA - orderB;
                    return new Date(a.returnDate).getTime() - new Date(b.returnDate).getTime();
                  });
                const activeBorrowings = allActiveBorrowings.slice(0, 20);
                const remainingBorrowings = allActiveBorrowings.length - activeBorrowings.length;

                let replyText;
                if (activeBorrowings.length === 0) {
                  replyText = `📷 รายการยืมอุปกรณ์ค้างอยู่\n──────────────\nไม่มีรายการค้างครับ`;
                } else {
                  replyText = `📷 รายการยืมอุปกรณ์ค้างอยู่ (${activeBorrowings.length}${remainingBorrowings > 0 ? ' จาก ' + allActiveBorrowings.length : ''} รายการ)\n`;
                  activeBorrowings.forEach((b, i) => {
                    const statusTag = b.status === 'เกินกำหนด' ? '⚠️ เกินกำหนด' : b.status;
                    replyText += `\n${statusTag}\n`;
                    replyText += `👤 ${b.borrowerName}\n`;
                    replyText += `📦 ${b.equipmentList}\n`;
                    replyText += `🗓️ คืน: ${new Date(b.returnDate).toLocaleDateString('th-TH')}\n`;
                    if (i < activeBorrowings.length - 1) replyText += '\n━━━━━━\n';
                  });
                  if (remainingBorrowings > 0) {
                    replyText += `\n\n...และอีก ${remainingBorrowings} รายการ (แสดงแค่ 20 รายการแรกเท่านั้น)`;
                  }
                }
                await replyToLine(env, event.replyToken, replyText, 'Equipment report');

                console.log(`[Mention] Equipment report sent (${activeBorrowings.length}/${allActiveBorrowings.length} borrowings)`);

              // คำสั่ง: @Bot ซ่อม / แจ้งซ่อม / รายงานซ่อม → รายงานแจ้งซ่อมที่ยังไม่เสร็จ (เผื่อ Push token หมด เรียกดูเองได้)
              } else if (text.includes('ซ่อม')) {
                const repairs = await env.REPAIR_REQUESTS_KV.get('repairs_data', 'json') || [];
                const activeRepairStatuses = ['รอดำเนินการ', 'กำลังซ่อม'];
                const repairPriority = { 'ด่วนที่สุด': 1, 'ด่วน': 2, 'ปกติ': 3 };
                const allActiveRepairs = repairs
                  .filter(r => activeRepairStatuses.includes(r.status))
                  .sort((a, b) => {
                    const orderA = repairPriority[a.priority] || 99;
                    const orderB = repairPriority[b.priority] || 99;
                    if (orderA !== orderB) return orderA - orderB;
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                  });
                const activeRepairs = allActiveRepairs.slice(0, 20);
                const remainingRepairs = allActiveRepairs.length - activeRepairs.length;

                let replyText;
                if (activeRepairs.length === 0) {
                  replyText = `🛠️ รายการแจ้งซ่อมค้างอยู่\n──────────────\nไม่มีรายการค้างครับ`;
                } else {
                  replyText = `🛠️ รายการแจ้งซ่อมค้างอยู่ (${activeRepairs.length}${remainingRepairs > 0 ? ' จาก ' + allActiveRepairs.length : ''} รายการ)\n`;
                  activeRepairs.forEach((r, i) => {
                    const priorityTag = r.priority === 'ด่วนที่สุด' ? '🔥 ด่วนที่สุด' : r.priority;
                    replyText += `\n${priorityTag} · ${r.status}\n`;
                    replyText += `👤 ${r.requesterName} (${r.department})\n`;
                    replyText += `📍 ${r.roomName}\n`;
                    replyText += `🔧 ${r.problemType}\n`;
                    replyText += `📝 ${r.description}\n`;
                    if (i < activeRepairs.length - 1) replyText += '\n━━━━━━\n';
                  });
                  if (remainingRepairs > 0) {
                    replyText += `\n\n...และอีก ${remainingRepairs} รายการ (แสดงแค่ 20 รายการแรกเท่านั้น)`;
                  }
                }
                await replyToLine(env, event.replyToken, replyText, 'Repair report');

                console.log(`[Mention] Repair report sent (${activeRepairs.length}/${allActiveRepairs.length} repairs)`);

              // คำสั่ง: @Bot รายงาน / จอง / จองพรุ่งนี้ / จอง 16-6-69 / จอง 20 ก.ค. 69
              } else if (text.includes('รายงาน') || text.includes('จอง') || text.includes('ห้อง')) {

                const nowTH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));

                // ── กรณี: รายงานทั้งสัปดาห์ ("รายงานสัปดาห์นี้" / "รายงานสัปดาห์หน้า") ──
                // สัปดาห์นับแบบไทย: จันทร์–อาทิตย์
                if (text.includes('สัปดาห์')) {
                  const dow = nowTH.getDay(); // 0=อาทิตย์ ... 6=เสาร์
                  const diffToMonday = dow === 0 ? -6 : 1 - dow;
                  const monday = new Date(nowTH);
                  monday.setDate(nowTH.getDate() + diffToMonday);
                  if (text.includes('หน้า')) monday.setDate(monday.getDate() + 7); // สัปดาห์หน้า

                  const weekDates = [];
                  for (let i = 0; i < 7; i++) {
                    const d = new Date(monday);
                    d.setDate(monday.getDate() + i);
                    weekDates.push(d);
                  }

                  const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  const thaiDayNames = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
                  const todayISO = toISO(nowTH);

                  const weekLabel = text.includes('หน้า') ? 'สัปดาห์หน้า' : 'สัปดาห์นี้';
                  const rangeLabel = `${weekDates[0].toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} – ${weekDates[6].toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`;

                  const bookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
                  let replyText = `📊 รายงานการจอง${weekLabel} (${rangeLabel})\n══════════════\n`;
                  let totalCount = 0;

                  weekDates.forEach(d => {
                    const iso = toISO(d);
                    const dayBookings = bookings
                      .filter(b => b.date === iso && b.status === 'จองแล้ว')
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));

                    const dayName = thaiDayNames[d.getDay()];
                    const todayTag = iso === todayISO ? ' (วันนี้)' : '';
                    replyText += `\n📆 วัน${dayName} ${d.getDate()}/${d.getMonth() + 1}${todayTag}`;

                    if (dayBookings.length === 0) {
                      replyText += ` — ไม่มีการจอง\n`;
                    } else {
                      replyText += ` (${dayBookings.length} รายการ)\n`;
                      dayBookings.forEach(b => {
                        replyText += `   ${b.startTime}–${b.endTime} น. 🏢${b.roomName} 👤${b.bookerName}\n`;
                      });
                      totalCount += dayBookings.length;
                    }
                  });

                  replyText += `\n──────────────\nรวมทั้งสัปดาห์: ${totalCount} รายการ`;
                  await replyToLine(env, event.replyToken, replyText, 'Weekly report');

                  console.log(`[Mention] Weekly report sent (${totalCount} bookings, ${weekLabel})`);

                } else if (text.includes('ทั้งหมด') || text.includes('ที่จะถึง')) {
                  // ── กรณี: รายงานการจองที่จะถึงทั้งหมด (จำกัด 20 รายการถัดไป) ──────
                  const todayISO = `${nowTH.getFullYear()}-${String(nowTH.getMonth() + 1).padStart(2, '0')}-${String(nowTH.getDate()).padStart(2, '0')}`;

                  // แปลง "YYYY-MM-DD" เป็นวันที่แสดงผลแบบไทย โดยไม่พึ่ง new Date(string)
                  // เพื่อเลี่ยงปัญหา timezone parsing ที่อาจเลื่อนวันผิด
                  const formatDateDisplay = (iso) => {
                    const [y, m, d] = iso.split('-').map(Number);
                    return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
                  };

                  const bookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
                  const allUpcoming = bookings
                    .filter(b => b.status === 'จองแล้ว' && b.date >= todayISO)
                    .sort((a, b) => a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date));
                  const upcoming = allUpcoming.slice(0, 20);
                  const remaining = allUpcoming.length - upcoming.length;

                  let replyText;
                  if (upcoming.length === 0) {
                    replyText = `📅 การจองที่จะถึง\n──────────────\nไม่มีการจองที่จะถึงครับ`;
                  } else {
                    replyText = `📅 การจองที่จะถึง (${upcoming.length}${remaining > 0 ? ' จาก ' + allUpcoming.length : ''} รายการ)\n`;
                    upcoming.forEach((b, i) => {
                      replyText += `\n${formatDateDisplay(b.date)} | ${b.startTime}–${b.endTime} น.\n`;
                      replyText += `🏢 ${b.roomName}\n`;
                      replyText += `📝 ${b.purpose}\n`;
                      replyText += `👤 ${b.bookerName}\n`;
                      if (i < upcoming.length - 1) replyText += '\n━━━━━━\n';
                    });
                    if (remaining > 0) {
                      replyText += `\n\n...และอีก ${remaining} รายการ (แสดงแค่ 20 รายการถัดไปเท่านั้น)`;
                    }
                  }
                  await replyToLine(env, event.replyToken, replyText, 'Upcoming report');

                  console.log(`[Mention] Upcoming report sent (${upcoming.length}/${allUpcoming.length} bookings)`);

                } else {
                  // ── กรณี: รายงานรายวัน (วันนี้ / พรุ่งนี้ / มะรืนนี้ / วันที่ระบุ) ──────────

                  // ── แปลงวันที่จากข้อความ ──────────────────────────────────
                  // แผนที่ชื่อเดือนไทย (เต็ม / ย่อมีจุด / ย่อไม่มีจุด) → เลขเดือน
                  const thaiMonthMap = {
                    'มกราคม': 1, 'ม.ค.': 1, 'มค': 1,
                    'กุมภาพันธ์': 2, 'ก.พ.': 2, 'กพ': 2,
                    'มีนาคม': 3, 'มี.ค.': 3, 'มีค': 3,
                    'เมษายน': 4, 'เม.ย.': 4, 'เมย': 4,
                    'พฤษภาคม': 5, 'พ.ค.': 5, 'พค': 5,
                    'มิถุนายน': 6, 'มิ.ย.': 6, 'มิย': 6,
                    'กรกฎาคม': 7, 'ก.ค.': 7, 'กค': 7,
                    'สิงหาคม': 8, 'ส.ค.': 8, 'สค': 8,
                    'กันยายน': 9, 'ก.ย.': 9, 'กย': 9,
                    'ตุลาคม': 10, 'ต.ค.': 10, 'ตค': 10,
                    'พฤศจิกายน': 11, 'พ.ย.': 11, 'พย': 11,
                    'ธันวาคม': 12, 'ธ.ค.': 12, 'ธค': 12,
                  };
                  // เรียงชื่อเดือนจากยาว→สั้น กันแมตช์ผิด (เช่น "กค" ไปกินก่อน "กรกฎาคม")
                  // แล้วประกอบเป็น regex เดียว: ตัวเลขวัน + ชื่อเดือน + ปี (ไม่บังคับ)
                  const monthPattern = Object.keys(thaiMonthMap)
                    .sort((a, b) => b.length - a.length)
                    .map(k => k.replace(/\./g, '\\.'))
                    .join('|');
                  const thaiMonthRegex = new RegExp(`(\\d{1,2})\\s*(${monthPattern})\\s*(\\d{2,4})?`);

                  // แปลงปี: ไม่ระบุ → ปีปัจจุบัน, 2 หลัก (69) → พ.ศ., 4 หลัก พ.ศ./ค.ศ. → ค.ศ. เสมอ
                  const normalizeYear = (yy, fallbackYearCE) => {
                    if (!yy) return fallbackYearCE;
                    if (yy.length === 2) return 2500 + parseInt(yy) - 543; // 69 → 2569(พ.ศ.) → 2026(ค.ศ.)
                    const y = parseInt(yy);
                    return y > 2500 ? y - 543 : y;                        // 2569 → 2026, 2025 → 2025
                  };

                  const parseDate = (t) => {
                    if (t.includes('วันนี้')) {
                      return nowTH;
                    }
                    if (t.includes('พรุ่งนี้') || t.includes('พรุ่ง')) {
                      const d = new Date(nowTH); d.setDate(d.getDate() + 1); return d;
                    }
                    if (t.includes('มะรืน') || t.includes('มะเรืน')) {
                      const d = new Date(nowTH); d.setDate(d.getDate() + 2); return d;
                    }

                    // รูปแบบชื่อเดือนไทย เช่น "20 ก.ค. 69", "20 กรกฎาคม 2569", "20กค2025"
                    const thaiMatch = t.match(thaiMonthRegex);
                    if (thaiMatch) {
                      const [, dd, monthText, yy] = thaiMatch;
                      const mm = thaiMonthMap[monthText];
                      const yearCE = normalizeYear(yy, nowTH.getFullYear());
                      return new Date(yearCE, mm - 1, parseInt(dd));
                    }

                    // รูปแบบตัวเลข: DD-M-YY, DD-MM-YY, DD/M/YYYY, DD.M.YY ฯลฯ
                    const match = t.match(/(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
                    if (match) {
                      const [, dd, mm, yy] = match;
                      const yearCE = normalizeYear(yy, nowTH.getFullYear());
                      return new Date(yearCE, parseInt(mm) - 1, parseInt(dd));
                    }

                    return nowTH; // default = วันนี้
                  };

                  const targetDate = parseDate(text);
                  const targetISO = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
                  const targetDisplay = targetDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

                  // label วันสำหรับหัวข้อ
                  const todayISO0 = `${nowTH.getFullYear()}-${String(nowTH.getMonth() + 1).padStart(2, '0')}-${String(nowTH.getDate()).padStart(2, '0')}`;
                  const tom = new Date(nowTH); tom.setDate(nowTH.getDate() + 1);
                  const tomISO = `${tom.getFullYear()}-${String(tom.getMonth() + 1).padStart(2, '0')}-${String(tom.getDate()).padStart(2, '0')}`;
                  const dayAfter = new Date(nowTH); dayAfter.setDate(nowTH.getDate() + 2);
                  const dayAfterISO = `${dayAfter.getFullYear()}-${String(dayAfter.getMonth() + 1).padStart(2, '0')}-${String(dayAfter.getDate()).padStart(2, '0')}`;

                  let dayLabel = targetDisplay;
                  if (targetISO === todayISO0) dayLabel += ' (วันนี้)';
                  else if (targetISO === tomISO) dayLabel += ' (พรุ่งนี้)';
                  else if (targetISO === dayAfterISO) dayLabel += ' (มะรืนนี้)';

                  // ── ดึงข้อมูลจอง ──────────────────────────────────────────
                  const bookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
                  const dayBookings = bookings
                    .filter(b => b.date === targetISO && b.status === 'จองแล้ว')
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  const arrangementLabel = (a) => {
                    if (!a) return null;
                    if (a === 'classroom') return 'จัดโต๊ะรูปแบบคลาสรูม';
                    if (a === 'u-shape') return 'จัดโต๊ะรูปแบบตัวยู U';
                    if (a.startsWith('other:')) return `จัดโต๊ะ: ${a.slice(6)}`;
                    return null;
                  };

                  let replyText;
                  if (dayBookings.length === 0) {
                    replyText = `📅 รายการจอง ${dayLabel}\n──────────────\nไม่มีการจองครับ`;
                  } else {
                    replyText = `📅 รายการจอง ${dayLabel} (${dayBookings.length} รายการ)\n`;
                    dayBookings.forEach((b, i) => {
                      const arr = arrangementLabel(b.roomArrangement);
                      replyText += `\n${b.date} | ${b.startTime}–${b.endTime} น.\n`;
                      replyText += `🏢 ${b.roomName}\n`;
                      replyText += `📝 ${b.purpose}\n`;
                      replyText += `👤 ${b.bookerName}\n`;
                      if (arr) replyText += `🪑 ${arr}\n`;
                      if (i < dayBookings.length - 1) replyText += '\n━━━━━━\n';
                    });
                  }
                  await replyToLine(env, event.replyToken, replyText, 'Daily report');

                  console.log(`[Mention] Replied with ${dayBookings.length} bookings for ${targetISO}`);
                }

              } else {
                // @บอทแล้วไม่ตรงคำสั่งไหนเลย — เดิมบอทเงียบ ทำให้คนคิดว่าบอทเสีย
                const helpText =
                  `🤖 พิมพ์ @ชื่อบอท ตามด้วยคำสั่งเหล่านี้ได้ครับ\n` +
                  `──────────────\n` +
                  `📅 จองวันนี้ / จองพรุ่งนี้ / จอง 20 ก.ค. 69\n` +
                  `   → รายการจองห้องของวันนั้น\n\n` +
                  `📊 รายงานสัปดาห์นี้ / รายงานสัปดาห์หน้า\n` +
                  `   → รายการจองทั้งสัปดาห์ (จันทร์–อาทิตย์)\n\n` +
                  `📋 จองทั้งหมด\n` +
                  `   → การจองที่จะถึง 20 รายการถัดไป\n\n` +
                  `📷 ยืม → อุปกรณ์ที่ยังไม่ได้คืน\n` +
                  `🛠️ ซ่อม → งานแจ้งซ่อมที่ยังค้างอยู่`;
                await replyToLine(env, event.replyToken, helpText, 'Help');
                console.log('[Mention] Help message sent (unknown command)');
              }
            }
          }
          // ── End Mention Handler ───────────────────────────────────────────
        }
      } catch (e) {
        console.error(`[Webhook Error] ${e.message}`);
      }
      return new Response('OK', { status: 200 });
    }

    // ── PROTECTED ROUTES (ต้องใช้ X-API-Key Header) ─────────────────────────

    // ตรวจสอบ API Key ทุก request จากนี้เป็นต้นไป
    // Key ต้องตรงกับ API_SECRET_KEY ใน Worker Settings
    // และ VITE_API_SECRET_KEY ใน Cloudflare Pages Settings
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== env.API_SECRET_KEY) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {

      // ── /data — อ่าน/เขียนข้อมูล KV ─────────────────────────────────────
      // GET  ?type=rooms      → ดึงข้อมูลการจองห้องทั้งหมด
      // POST ?type=rooms      → บันทึก (overwrite ทั้งหมด ระวัง!)
      // GET  ?type=equipment  → ดึงข้อมูลการยืมอุปกรณ์
      // POST ?type=equipment  → บันทึกการยืมอุปกรณ์
      // GET  ?type=repairs    → ดึงข้อมูลการแจ้งซ่อมอุปกรณ์ไอที
      // POST ?type=repairs    → บันทึกการแจ้งซ่อมอุปกรณ์ไอที
      if (path === '/data') {
        const type = url.searchParams.get('type');
        const KV_BINDINGS = {
          rooms: 'ROOM_BOOKINGS_KV',
          equipment: 'EQUIPMENT_BORROWINGS_KV',
          repairs: 'REPAIR_REQUESTS_KV',
        };
        const KV_NAME = KV_BINDINGS[type];
        if (!KV_NAME) {
          return json({ error: `Unknown data type: ${type}` }, 400);
        }
        const KV = env[KV_NAME];
        const kvError = checkKvBinding(KV, KV_NAME); // เก็บ error ไว้ตัวแปรก่อน (ไม่เรียกซ้ำ)
        if (kvError) return kvError;

        if (request.method === 'GET') {
          // ?version=prev → อ่านสำเนาก่อนการบันทึกครั้งล่าสุด (ใช้กู้ข้อมูลเวลาเขียนทับพลาด)
          const wantsPrevious = url.searchParams.get('version') === 'prev';
          const data = await KV.get(wantsPrevious ? `${type}_data_prev` : `${type}_data`, 'json') || [];

          // ส่งเลขรุ่นของข้อมูลติดไปด้วย — ฝั่งเว็บเก็บไว้แล้วแนบกลับมาตอนบันทึก
          // เพื่อให้ Worker รู้ว่าเขียนทับของใหม่กว่าอยู่หรือเปล่า (ดูหัวข้อ POST)
          const version = (await KV.get(`${type}_data_version`)) || '0';
          const response = json(data);
          response.headers.set('X-Data-Version', version);
          return response;
        }

        if (request.method === 'POST') {
          let incoming;
          try {
            incoming = await request.json();
          } catch (e) {
            return json({ error: 'Body ไม่ใช่ JSON ที่ถูกต้อง' }, 400);
          }

          // กันข้อมูลหายจากการส่ง body ผิดรูป (null / object / string) มาทับ array ทั้งก้อน
          if (!Array.isArray(incoming)) {
            console.error(`[Data Guard] Rejected non-array payload for "${type}"`);
            return json({ error: 'ข้อมูลต้องเป็น array เท่านั้น' }, 400);
          }

          // ── กันข้อมูลของคนอื่นหายเพราะบันทึกพร้อมกัน ────────────────────────
          // endpoint นี้เขียนทับทั้ง array เสมอ ถ้า A กับ B เปิดหน้าเดียวกันแล้วบันทึกไล่กัน
          // ของ A จะหายไปทั้งก้อนโดยไม่มีใครรู้ (last write wins)
          // ตอนนี้ฝั่งเว็บแนบ X-Data-Version ที่ได้ตอน GET กลับมาด้วย ถ้าไม่ตรงกับของใน KV
          // แปลว่ามีคนบันทึกแทรกไปแล้ว → ตอบ 409 พร้อมข้อมูลล่าสุด ให้ฝั่งเว็บรวมแล้วส่งใหม่
          //
          // ⚠️ KV เป็น eventually consistent ไม่ใช่ transaction — ถ้าสองคนบันทึกพร้อมกัน
          //    ในระดับวินาทีเดียวกันจากคนละภูมิภาค อาจตรวจไม่เจอ ทางแก้ที่ปิดช่องได้จริง
          //    ต้องย้ายไป Durable Objects หรือ D1 (ดู TODO ใน DEVELOPER_GUIDE)
          const currentVersion = (await KV.get(`${type}_data_version`)) || '0';
          const clientVersion = request.headers.get('X-Data-Version');
          if (clientVersion && clientVersion !== currentVersion) {
            console.warn(`[Data Guard] Conflict on "${type}": client=${clientVersion} current=${currentVersion}`);
            const current = await KV.get(`${type}_data`, 'json') || [];
            const conflictResponse = json({
              error: 'conflict',
              message: 'มีคนบันทึกข้อมูลแทรกเข้ามาก่อน',
              version: currentVersion,
              data: current,
            }, 409);
            conflictResponse.headers.set('X-Data-Version', currentVersion);
            return conflictResponse;
          }
          const newVersion = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

          // เก็บสำเนาของเดิมไว้ก่อนเขียนทับ — /data?type=...&version=prev ดึงกลับมาได้
          // (endpoint นี้เขียนทับทั้งก้อนเสมอ ถ้าไม่มีสำเนาไว้ พลาดครั้งเดียวคือข้อมูลหายถาวร)
          const previous = await KV.get(`${type}_data`);
          if (previous) {
            await KV.put(`${type}_data_prev`, previous);
            await KV.put(`${type}_data_prev_at`, new Date().toISOString());

            // เตือนไว้ใน log เมื่อจำนวนรายการหายไปเกินครึ่ง — ไล่ดูย้อนหลังได้ว่าเกิดตอนไหน
            try {
              const previousCount = JSON.parse(previous).length;
              if (previousCount >= 10 && incoming.length < previousCount / 2) {
                console.warn(`[Data Guard] "${type}" shrank ${previousCount} → ${incoming.length} รายการ (สำเนาเดิมอยู่ที่ ${type}_data_prev)`);
              }
            } catch (e) { /* ของเดิมพัง ข้ามการเทียบไป */ }
          }

          await KV.put(`${type}_data`, JSON.stringify(incoming));
          await KV.put(`${type}_data_version`, newVersion);
          const okResponse = json({ success: true, count: incoming.length, version: newVersion });
          okResponse.headers.set('X-Data-Version', newVersion);
          return okResponse;
        }
      }

      // ── /notify — ส่ง LINE Push Message ──────────────────────────────────
      // Frontend ส่ง { message: "ข้อความ", target?: "repair" } มา แล้ว Worker ส่งต่อให้ LINE
      // target: "repair" → ส่งเข้าเฉพาะกลุ่ม REPAIR_GROUP_ID เท่านั้น (ไม่ส่งเข้า recipient ทั่วไป)
      // ไม่ระบุ target → ส่งเข้าทุก recipient ตามปกติ (ใช้กับระบบจองห้อง)
      // ใช้ ctx.waitUntil เพื่อไม่ให้ response รอ LINE ตอบกลับ (non-blocking)
      if (path === '/notify' && request.method === 'POST') {
        const { message, target } = await request.json();

        if (typeof message !== 'string' || message.trim() === '') {
          return json({ success: false, error: 'ไม่มีข้อความที่จะส่ง' }, 400);
        }

        if (target === 'repair' && !env.REPAIR_GROUP_ID) {
          console.error('[LINE Push Error] REPAIR_GROUP_ID not configured — skipped repair notification.');
          return json({
            success: false, sent: 0, failed: 0, total: 0,
            error: 'ยังไม่ได้ตั้งค่า REPAIR_GROUP_ID ใน Worker',
          }, 200);
        }

        // รอผลจาก LINE จริง ๆ ก่อนตอบกลับ (เดิมใช้ ctx.waitUntil แล้วตอบ success ทันที
        // หน้าเว็บจึงขึ้นว่า "ส่งสำเร็จ" แม้ push จะล้มเหลวทุกปลายทาง เช่น token หมดอายุ
        // หรือโควตาข้อความรายเดือนเต็ม) — ปกติใช้เวลาไม่ถึงวินาที
        const result = target === 'repair'
          ? await sendNotification(message, env, [env.REPAIR_GROUP_ID])
          : await sendNotification(message, env);

        return json({
          success: result.sent > 0,
          sent: result.sent,
          failed: result.failed,
          total: result.total,
          removed: result.removed,
          error: result.sent > 0 ? undefined : (result.errors[0] || 'ส่งแจ้งเตือนไม่สำเร็จ'),
        });
      }

      // ── /recipients — ดูรายชื่อผู้รับแจ้งเตือน พร้อมชื่อกลุ่มจริงจาก LINE ──
      // ดึงชื่อสดจาก LINE API ทุกครั้งที่เรียก (ไม่ได้แคช/เก็บชื่อไว้ที่ไหน)
      // ถ้ามีคนเปลี่ยนชื่อกลุ่มใน LINE ภายหลัง เรียก endpoint นี้ใหม่จะเห็นชื่อล่าสุดทันที
      if (path === '/recipients' && request.method === 'GET') {
        // รวมกลุ่มที่หยุดรับแจ้งเตือนแล้วมาด้วย (active: false) เพื่อให้ยังเห็น Group ID
        // เอาไปก็อปใช้ต่อได้ เช่น ใส่ใน REPAIR_GROUP_ID หรือเปิดรับใหม่ภายหลัง
        const stored = await listRecipients(env);
        if (stored.length === 0) await getRecipientIds(env); // เผื่อยังต้อง migrate ของเก่า
        const entries = stored.length > 0 ? stored : (await listRecipients(env));

        const recipients = await Promise.all(entries.map(async ({ id, active, value }) => {
          const isGroup = id.startsWith('C');
          const summaryUrl = isGroup
            ? `https://api.line.me/v2/bot/group/${id}/summary`
            : `https://api.line.me/v2/bot/profile/${id}`;
          const base = { id, type: isGroup ? 'group' : 'user', active, status: value || '1' };
          try {
            const res = await fetch(summaryUrl, {
              headers: { 'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}` },
            });
            if (!res.ok) return { ...base, name: null };
            const data = await res.json();
            return { ...base, name: isGroup ? data.groupName : data.displayName };
          } catch (e) {
            return { ...base, name: null };
          }
        }));
        return json(recipients);
      }

      return json({ error: 'Route not found' }, 404);

    } catch (e) {
      console.error(`[Worker Error] ${e.message}\n${e.stack}`);
      return json({ error: 'Worker internal error' }, 500);
    }
  },

  // ───────────────────────────────────────────────────────────────────────────
  //  scheduled(event, env, ctx)
  //  รันตามเวลาที่กำหนด (Cron Trigger)
  //  ตั้งค่า Cron: Dashboard → tcc-line-notifier → Settings → Triggers → Cron
  //  แนะนำ: "0 1 * * *"  (ทุกวัน เวลา 01:00 UTC = 08:00 น. ไทย)
  //  ทำหน้าที่: ส่งสรุปการจองห้องวันนี้ไปยัง LINE
  // ───────────────────────────────────────────────────────────────────────────
  async scheduled(event, env, ctx) {
    // ต้องใช้วันที่ตามเวลาไทย ไม่ใช่ UTC — ไม่งั้นถ้าเปลี่ยนเวลา cron ไปช่วงค่ำของไทย
    // สรุปที่ส่งจะกลายเป็นของ "เมื่อวาน" โดยไม่มีใครสังเกต
    const today = bangkokDateISO();
    const bookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
    const todayBookings = bookings
      .filter(b => b.date === today && b.status === 'จองแล้ว')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayBookings.length === 0) {
      console.log(`[Scheduled] ${today} — ไม่มีการจอง ไม่ต้องส่งแจ้งเตือน`);
      return;
    }

    const dateLabel = new Date(`${today}T00:00:00+07:00`)
      .toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Bangkok' });

    let reportMsg = `📊 สรุปการจองห้องประชุมวันนี้ (${dateLabel})\n──────────────\n`;
    todayBookings.forEach(b => {
      reportMsg += `\n🕐 ${b.startTime}–${b.endTime} น.\n🏢 ${b.roomName}\n📝 ${b.purpose}\n👤 ${b.bookerName}\n`;
    });
    reportMsg += `\n──────────────\nรวม ${todayBookings.length} รายการ`;

    // ข้อความยาวเกิน 5,000 ตัวอักษรจะถูกตัดเป็นหลายข้อความให้เองใน sendNotification
    const result = await sendNotification(reportMsg, env);
    console.log(`[Scheduled] ${today} — ${todayBookings.length} bookings, sent=${result.sent}/${result.total}`);
    if (result.failed > 0) {
      console.error(`[Scheduled] ส่งไม่สำเร็จ ${result.failed} ปลายทาง: ${result.errors.join(', ')}`);
    }
  }
};
