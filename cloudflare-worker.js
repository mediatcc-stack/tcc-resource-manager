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
 *    ค่าใน key = {"topics":["rooms"],"left":null} — topics คือเรื่องที่กลุ่มนั้นรับ
 *    (rooms = จองห้อง, repairs = แจ้งซ่อม) ตั้งได้จากหน้าแอดมินในเว็บ ไม่ต้องแก้ KV เอง
 *    left ไม่ว่าง = บอทไม่ได้อยู่ในกลุ่มแล้ว (ไม่ลบ key ทิ้ง Group ID จึงยังอยู่ให้ใช้ต่อ)
 *    ค่าเดิมแบบเก่ายังใช้ได้: "1"/"on" = รับจองห้อง, "off" = ไม่รับ, "rooms,repairs" ก็ได้
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
 *  แจ้งเตือนอัตโนมัติทุกเช้า (Scheduled): ❌ ปิดการใช้งานแล้ว (v2.13)
 *    ถ้ายังมี Cron Trigger ค้างที่ Dashboard → Settings → Triggers ให้ลบทิ้งได้เลย
 *    ดูรายการจองแทนได้ที่แท็บ "ตารางการจอง" ในเว็บ หรือพิมพ์ @ชื่อบอท จองวันนี้ ในกลุ่ม
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
 *  │                          │  /webhook (⚠️ ต้องตั้ง! ถ้าไม่ตั้ง Worker      │
 *  │                          │  จะปฏิเสธทุก event ที่เข้ามา (503) —          │
 *  │                          │  ดูที่ verifyLineSignature)                    │
 *  │  RECIPIENT_ID            │  LINE User ID สำรอง (ถ้า KV ว่าง)            │
 *  │  REPAIR_GROUP_ID         │  LINE Group ID เฉพาะสำหรับแจ้งซ่อม           │
 *  │                          │  (แจ้งเตือน /notify?target=repair จะส่ง      │
 *  │                          │  เข้ากลุ่มนี้เท่านั้น ไม่ส่งเข้า recipient ทั่วไป)│
 *  ├──────────────────────────┼────────────────────────────────────────────────┤
 *  │  ── ไม่บังคับ (มีค่าเริ่มต้นให้อยู่แล้ว) ──                                │
 *  │  ALLOWED_ORIGINS         │  Origin ที่เรียก API ได้ คั่นด้วย comma       │
 *  │                          │  (ค่าเริ่มต้นครอบคลุม pages.dev + localhost)  │
 *  │                          │  ใส่เพิ่มเมื่อย้ายไปโดเมนของวิทยาลัยเอง        │
 *  │  ADMIN_TOKEN_SECRET      │  กุญแจเซ็นตั๋วแอดมิน — ถ้าไม่ตั้ง จะใช้       │
 *  │                          │  ADMIN_PASSWORD เซ็นแทน (ตั้งไว้ดีกว่า       │
 *  │                          │  เพราะเปลี่ยนรหัสผ่านแล้วคนที่ล็อกอินค้างอยู่  │
 *  │                          │  จะไม่หลุดออกทั้งหมด)                         │
 *  └──────────────────────────┴────────────────────────────────────────────────┘
 *
 *  ถ้าต้องการเปลี่ยนรหัสผ่าน Admin:
 *    Dashboard → Settings → Edit → ADMIN_PASSWORD → บันทึก → Deploy ใหม่
 *    ⚠️ ถ้าไม่ได้ตั้ง ADMIN_TOKEN_SECRET ไว้ การเปลี่ยนรหัสผ่านจะทำให้ตั๋วแอดมิน
 *       ทุกใบใช้ไม่ได้ทันที (ทุกคนต้องล็อกอินใหม่) — ซึ่งเป็นสิ่งที่ต้องการเวลา
 *       รหัสผ่านหลุด แต่ถ้าแค่เปลี่ยนตามรอบ ให้ตั้ง ADMIN_TOKEN_SECRET แยกไว้
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
 *  ⚠️  หลัง deploy ต้องทดสอบทันที — เปิดหน้าเว็บ เข้าโหมดเจ้าหน้าที่
 *      แล้วกด "ตรวจสอบระบบ" ต้องได้ { lineApiToken: true, roomKvBinding: true, ... }
 *      (/status ไม่เปิดสาธารณะแล้ว เรียกจาก URL ตรง ๆ จะได้ 401)
 *
 *  ⚠️  ก่อน deploy ให้รันชุดทดสอบก่อนเสมอ:  node scripts/worker-test.mjs
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  📡  API Endpoints ทั้งหมด
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  ⚠️  ทุก route ตอบเฉพาะ Origin ที่อยู่ในรายการ (ดู corsHeadersFor) และแบ่งเป็น
 *      3 ชั้น: สาธารณะ → ต้องมี X-API-Key → ต้องมี X-Admin-Token ด้วย
 *
 *  PUBLIC (ไม่ต้องใช้ API Key):
 *    POST /auth/login      → Body: { password }
 *                            สำเร็จ → { success: true, token, expiresAt }
 *                            token = ตั๋วแอดมิน แนบใน Header X-Admin-Token
 *                            (จำกัด 10 ครั้ง/IP/15 นาที, ตั๋วอายุ 12 ชม.)
 *    POST /webhook         → รับ event จาก LINE (เพิ่ม recipient อัตโนมัติ +
 *                            @Mention Handler: ตอบรายงานผ่าน Reply Token ไม่กิน Push
 *                            quota — พิมพ์ "@Bot ยืม" (อุปกรณ์ค้างคืน), "@Bot ซ่อม"
 *                            (แจ้งซ่อมค้าง), "@Bot รายงาน/จอง..." (จองห้อง) ในกลุ่ม)
 *
 *  PROTECTED (ต้องใส่ Header: X-API-Key):
 *    ⚠️  API Key ถูกฝังอยู่ในไฟล์ JS ของหน้าเว็บ (Vite แทนค่าตอน build) ใครเปิด
 *        DevTools ก็อ่านได้ — ชั้นนี้กันได้แค่การเรียกแบบสุ่ม ไม่ใช่ความลับจริง
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
 *                                  [{ id, name, type, active, topics }]
 *                                  name ดึงสดจาก LINE API ทุกครั้ง (ไม่แคช)
 *                                  active: false = บอทไม่ได้อยู่ในกลุ่มแล้ว
 *                                  topics: หัวข้อที่กลุ่มนั้นรับ (rooms / repairs)
 *    POST /recipients           → Body: { id, topics: ["rooms","repairs"] }
 *                                  ตั้งว่ากลุ่มนี้รับแจ้งเตือนเรื่องอะไรบ้าง
 *                                  ([] = ไม่รับอะไรเลย) — หน้าแอดมินเรียกเมื่อติ๊ก
 *    DELETE /recipients?id=C...  → เอากลุ่มออกจากรายการถาวร (ใช้กับกลุ่มที่บอท
 *                                  ไม่ได้อยู่แล้ว) — ปกติแค่เอาติ๊กออกก็พอ
 *
 *  ADMIN ONLY (ต้องใส่ทั้ง X-API-Key และ X-Admin-Token):
 *    GET  /status               → สถานะการตั้งค่าของ Worker
 *    GET/POST/DELETE /recipients → จัดการกลุ่มที่รับแจ้งเตือน
 *    POST /data                 → เฉพาะกรณีที่รายการหายไปเกินครึ่ง (ลบยกชุด)
 *                                 การเพิ่ม/แก้ตามปกติไม่ต้องใช้ตั๋ว
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🛠️  แก้ไขล่าสุด
 * ═══════════════════════════════════════════════════════════════════════════════
 *  v2.13 (2026-09-09) — ปิดสรุปการจองประจำวันตอนเช้า (scheduled) ตามที่ผู้ใช้ขอ
 *                       เหลือ scheduled() ไว้เป็นตัวเปล่า เผื่อ Cron Trigger ค้างอยู่
 *                       จะได้ไม่ error — ลบ trigger ที่ Dashboard ได้เลย
 *  v3.0 (2026-09-10) — รอบตรวจความปลอดภัยทั้งระบบ (มีการเปลี่ยนพฤติกรรม)
 *                       • ⚠️ BREAKING: /status และ /recipients ต้องมีตั๋วแอดมิน
 *                         (X-Admin-Token) แล้ว — ต้อง deploy หน้าเว็บรุ่นใหม่คู่กัน
 *                       • ⚠️ BREAKING: /webhook ปฏิเสธทุก event ถ้าไม่ได้ตั้ง
 *                         CHANNEL_SECRET (503) เดิมข้ามการตรวจลายเซ็นให้ ซึ่งทำให้
 *                         ตอนตั้งค่าไม่ครบกลายเป็นตอนที่ไม่มีการป้องกันเลย
 *                       • /auth/login ออกตั๋วที่เซ็นด้วย HMAC-SHA256 (อายุ 12 ชม.)
 *                         แทนการตอบแค่ { success: true } — เดิมหน้าเว็บจำสถานะ
 *                         แอดมินไว้ที่ localStorage.isAdmin เอง ใครพิมพ์เองก็ได้สิทธิ์
 *                       • CORS จำกัดเฉพาะ Origin ของเรา (เดิมเปิด '*' ให้ทุกเว็บ)
 *                         เพิ่มโดเมนได้ที่ตัวแปร ALLOWED_ORIGINS
 *                       • POST /data ตรวจรูปร่างข้อมูล จำกัดขนาด และ "ลบยกชุด"
 *                         (รายการหายเกินครึ่ง) ต้องเป็นแอดมินเท่านั้น
 *                       • ล้างลิงก์ไฟล์แนบให้เหลือแต่ http/https — กัน javascript:
 *                         ที่กลายเป็นสคริปต์รันแทนเจ้าหน้าที่ตอนกดลิงก์ (stored XSS)
 *                       • /notify จำกัดความยาวข้อความและความถี่ต่อ IP
 *                       • เทียบรหัสผ่าน/ลายเซ็นแบบเวลาคงที่ และนับครั้งที่เดารหัส
 *                         ก่อนตรวจ (เดิมนับหลังตรวจ ซึ่งยิงพร้อมกันหลายเส้นแล้วรอด)
 *  v2.12 (2026-09-09) — DELETE /recipients?id=... เอากลุ่มที่บอทไม่ได้อยู่แล้ว
 *                       ออกจากรายการได้จากหน้าแอดมิน
 *  v2.11 (2026-09-09) — เลือกได้ว่าแต่ละกลุ่มรับแจ้งเตือน "เรื่องอะไร" (topics)
 *                       • ค่าใน recipient:<id> เก็บเป็น {"topics":[...],"left":null}
 *                         topics = rooms (จองห้อง) / repairs (แจ้งซ่อม)
 *                       • POST /recipients { id, topics } — หน้าแอดมินติ๊กเลือกได้เลย
 *                         ไม่ต้องแก้ KV เอง และไม่จำกัดว่าแจ้งซ่อมได้กลุ่มเดียว
 *                       • /notify เลือกปลายทางจากหัวข้อ: ไม่ระบุ target = rooms,
 *                         target "repair" = repairs
 *                       • ถ้ายังไม่มีกลุ่มไหนติ๊กหัวข้อนั้น ใช้ RECIPIENT_ID /
 *                         REPAIR_GROUP_ID เป็นตัวสำรอง (ระบบเดิมจึงไม่พัง)
 *                       • GET /recipients ดึงกลุ่มที่ตั้งไว้ใน REPAIR_GROUP_ID เข้ามา
 *                         ในรายการให้อัตโนมัติ จะได้ติ๊กจัดการในหน้าเว็บได้
 *                       • เชิญบอทกลับเข้ากลุ่มเดิม ยังจำหัวข้อที่เคยติ๊กไว้
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
//  CORS — อนุญาตเฉพาะ Origin ของเราเท่านั้น (เดิมเปิดกว้าง '*')
// ─────────────────────────────────────────────────────────────────────────────
//  ทำไมต้องจำกัด: API_SECRET_KEY ถูกฝังอยู่ในไฟล์ JS ของหน้าเว็บ (Vite แทนค่า
//  import.meta.env.VITE_* ตอน build) ใครเปิด DevTools ก็ก็อปคีย์ไปได้ คีย์นี้จึง
//  "ไม่ใช่ความลับ" กัน cross-origin ไว้อย่างน้อยเว็บอื่นจะยิง API แทนผู้ใช้ไม่ได้
//
//  เพิ่ม Origin ใหม่ได้ 2 ทาง (ไม่ต้องแก้โค้ด):
//    - ตั้ง ALLOWED_ORIGINS ใน Worker Settings เป็นรายการคั่นด้วย comma
//    - preview deployment ของ Cloudflare Pages (*.pages.dev) ผ่านให้อัตโนมัติ
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_ALLOWED_ORIGINS = [
  'https://tcc-media-booking.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

/** Origin ของ Cloudflare Pages preview เช่น https://abc1234.tcc-media-booking.pages.dev */
const PAGES_PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+\.tcc-media-booking\.pages\.dev$/;

const isAllowedOrigin = (origin, env) => {
  if (!origin) return false;
  const extra = (env?.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
  if (DEFAULT_ALLOWED_ORIGINS.includes(origin) || extra.includes(origin)) return true;
  return PAGES_PREVIEW_ORIGIN.test(origin);
};

/**
 * Header CORS สำหรับ request หนึ่ง ๆ
 * ถ้า Origin ไม่อยู่ในรายการ จะไม่ใส่ Access-Control-Allow-Origin เลย
 * เบราว์เซอร์จึงบล็อกไม่ให้เว็บนั้นอ่านผลลัพธ์
 * (request ที่ไม่มี Origin เช่น curl / LINE webhook ไม่ได้ถูกบล็อก — CORS เป็น
 *  กลไกของเบราว์เซอร์เท่านั้น ตัวกันจริงคือ API Key + Admin Token ด้านล่าง)
 */
const corsHeadersFor = (request, env) => {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-API-Key, X-Data-Version, X-Admin-Token',
    // เบราว์เซอร์จะไม่ยอมให้ JS อ่าน header ที่ไม่ใช่ header มาตรฐาน ถ้าไม่ประกาศตรงนี้
    // ถ้าลืมบรรทัดนี้ ฝั่งเว็บจะอ่าน X-Data-Version ไม่ได้ → ระบบกันข้อมูลชนกันจะเงียบไปเฉย ๆ
    'Access-Control-Expose-Headers': 'X-Data-Version',
    'Access-Control-Max-Age': '86400',
    // ตอบต่าง ๆ กันตาม Origin — บอก cache ไม่ให้เอาคำตอบของ Origin หนึ่งไปให้อีก Origin
    'Vary': 'Origin',
  };
  const origin = request.headers.get('Origin');
  if (isAllowedOrigin(origin, env)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
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

// ── ลิมิตของข้อมูลที่รับเข้ามาได้ ───────────────────────────────────────────
// endpoint /data เขียนทับทั้งก้อนเสมอ ถ้าไม่มีลิมิต ใครก็ยัดของใหญ่ ๆ เข้ามา
// ถมพื้นที่ KV จนระบบใช้งานไม่ได้ (ค่าจริงของระบบนี้อยู่หลักร้อยรายการ)
const MAX_RECORDS_PER_TYPE = 5000;
/** KV รับได้ 25 MB ต่อค่า — ตั้งไว้ต่ำกว่ามาก เพราะข้อมูลจริงเป็นข้อความล้วน */
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
/** ถ้ามีของอยู่เกินจำนวนนี้แล้วหายไปเกินครึ่ง ถือว่าเป็นการลบยกชุด (ต้องเป็นแอดมิน) */
const BULK_DELETE_MIN_RECORDS = 10;
/**
 * ข้อความแจ้งเตือน LINE ยาวสุดที่รับจากหน้าเว็บ
 * ตั้งให้พอดีกับที่ splitMessage() ส่งได้จริง (5 ข้อความ × 4,800 ตัวอักษร)
 * ยาวกว่านี้ก็ถูกตัดทิ้งอยู่ดี — ปฏิเสธไปเลยดีกว่ารับมาแล้วส่งไม่ครบเงียบ ๆ
 */
const MAX_NOTIFY_LENGTH = 5 * 4800;
/** จำกัดการยิง /notify: กี่ครั้งต่อ IP ภายในกี่วินาที — กันเอาบอทไปสแปมกลุ่ม LINE */
const NOTIFY_MAX_PER_WINDOW = 20;
const NOTIFY_WINDOW_SECONDS = 10 * 60;
/** key ที่บอกว่า migrate ข้อมูลผู้รับแบบเก่า (recipient_ids) มาแล้ว — กันข้อมูลเก่าฟื้นคืนชีพ */
const LEGACY_MIGRATED_KEY = 'recipient_ids_migrated';

// ─────────────────────────────────────────────────────────────────────────────
//  Helper รวม — ใช้ซ้ำทั้งไฟล์
// ─────────────────────────────────────────────────────────────────────────────

/**
 * สร้าง JSON Response (ใช้แทนการเขียนซ้ำทุกจุด)
 * header CORS ไม่ได้ใส่ตรงนี้ — ตัว fetch() จะเติมให้ทีเดียวตอนท้าย
 * ตาม Origin ของ request นั้น ๆ จึงไม่มีทางลืมใส่/ใส่ผิดเส้นทางไหน
 */
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // ข้อมูลการจอง/แจ้งซ่อมมีชื่อและเบอร์โทร — ห้าม proxy หรือเบราว์เซอร์เก็บแคชไว้
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });

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
 * ปล่อยผ่านเฉพาะลิงก์ http/https — คืนค่าว่างถ้าเป็นอย่างอื่น
 *
 * ⚠️  ทำไมต้องมี: ช่อง "ลิงก์ไฟล์แนบ" ในหน้าจองห้องเป็นข้อความที่ผู้ใช้พิมพ์เอง
 *     แล้วหน้าเว็บเอาไปใส่ใน <a href={...}> ตรง ๆ React ไม่ได้กรอง href ให้
 *     ถ้าใครกรอก javascript:... ไว้ พอเจ้าหน้าที่กดลิงก์นั้นในรายการจอง
 *     สคริปต์จะรันในหน้าเว็บด้วยสิทธิ์ของคนกด (stored XSS)
 *     กรองทั้งฝั่ง Worker (ตรงนี้) และฝั่งหน้าเว็บ (safeHref ใน constants.ts)
 *     เพราะข้อมูลเก่าที่บันทึกไว้ก่อนหน้านี้ยังอยู่ใน KV
 */
const sanitizeUrl = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed === '') return '';
  try {
    const scheme = new URL(trimmed).protocol;
    return scheme === 'http:' || scheme === 'https:' ? trimmed : '';
  } catch (e) {
    // ไม่ใช่ URL เต็มรูป เช่น "docs.google.com/..." ที่ผู้ใช้พิมพ์โดยไม่ใส่ https://
    // เติมให้เอง แล้วตรวจซ้ำ — ถ้ายังไม่ผ่านก็ทิ้ง
    try {
      const withScheme = new URL(`https://${trimmed}`);
      return withScheme.href;
    } catch (e2) {
      return '';
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Admin Session Token — พิสูจน์ว่า "คนที่เรียกเป็นแอดมินจริง"
// ─────────────────────────────────────────────────────────────────────────────
//  ⚠️  ปัญหาเดิม: หน้าเว็บเก็บสถานะแอดมินไว้ที่ localStorage.isAdmin = 'true'
//      เท่านั้น ใครเปิด DevTools แล้วพิมพ์ค่านั้นเองก็เป็นแอดมินได้ทันที
//      เพราะ Worker ไม่เคยตรวจว่าคนเรียกเป็นแอดมินจริงไหม — /auth/login แค่ตอบ
//      { success: true } กลับไปเฉย ๆ ไม่ได้ออกอะไรที่ตรวจสอบย้อนได้เลย
//
//  ตอนนี้ /auth/login จะออก "ตั๋ว" ที่เซ็นด้วย HMAC-SHA256 ฝั่ง Worker
//  หน้าเว็บแนบตั๋วกลับมาใน Header: X-Admin-Token ทุกครั้งที่เรียกงานของแอดมิน
//  ปลอมเองไม่ได้เพราะไม่รู้กุญแจ และหมดอายุเองใน 12 ชั่วโมง
//
//  กุญแจที่ใช้เซ็น: ADMIN_TOKEN_SECRET ถ้าตั้งไว้ ไม่งั้นใช้ ADMIN_PASSWORD
//  (ผลพลอยได้: พอเปลี่ยนรหัสผ่านแอดมิน ตั๋วเก่าทุกใบใช้ไม่ได้ทันที)
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const adminSigningKey = (env) => env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD || '';

/** base64url — ใช้ได้ใน HTTP header โดยไม่ต้อง encode ซ้ำ */
const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

/** เทียบสตริงแบบเวลาคงที่ — กันการเดาทีละตัวอักษรจากเวลาที่ใช้เปรียบเทียบ */
const timingSafeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

/** ออกตั๋วแอดมินใบใหม่ — รูปแบบ "<หมดอายุ(ms)>.<ค่าสุ่ม>.<ลายเซ็น>" */
async function issueAdminToken(env) {
  const secret = adminSigningKey(env);
  if (!secret) return null;
  const expiresAt = Date.now() + ADMIN_TOKEN_TTL_MS;
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(12)));
  const payload = `${expiresAt}.${nonce}`;
  const signature = b64url(await hmacSha256(secret, payload));
  return { token: `${payload}.${signature}`, expiresAt };
}

/** ตั๋วใบนี้ของจริงและยังไม่หมดอายุหรือไม่ */
async function isValidAdminToken(env, token) {
  const secret = adminSigningKey(env);
  if (!secret || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [expiresAt, nonce, signature] = parts;
  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;

  const expected = b64url(await hmacSha256(secret, `${expiresAt}.${nonce}`));
  return timingSafeEqual(expected, signature);
}

/** true = request นี้มาพร้อมตั๋วแอดมินที่ใช้ได้ */
const isAdminRequest = (request, env) =>
  isValidAdminToken(env, request.headers.get('X-Admin-Token'));

/**
 * ตรวจลายเซ็นของ Webhook จาก LINE (HMAC-SHA256 ของ body ดิบ ด้วย CHANNEL_SECRET)
 *
 * ⚠️  สำคัญมาก: ถ้าไม่ตรวจ ใครก็ตามที่รู้ URL ของ /webhook สามารถยิง event ปลอม
 *     เช่น {"events":[{"type":"join","source":{"groupId":"C..."}}]} เพื่อแอบเพิ่ม
 *     กลุ่มตัวเองเป็นผู้รับแจ้งเตือน แล้วจะได้รับข้อมูลการจอง (ชื่อผู้จอง/หัวข้อประชุม)
 *     ทั้งหมดของหน่วยงานไปเรื่อย ๆ โดยไม่มีใครรู้
 */
async function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;
  try {
    const mac = await hmacSha256(channelSecret, rawBody);
    // LINE ส่งลายเซ็นมาเป็น base64 มาตรฐาน (ไม่ใช่ base64url) จึงไม่ใช้ b64url() ตรงนี้
    const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
    return timingSafeEqual(expected, signature);
  } catch (e) {
    console.error(`[Webhook] Signature verification error: ${e.message}`);
    return false;
  }
}

/**
 * หัวข้อแจ้งเตือนที่กลุ่มหนึ่งสมัครรับได้
 *   rooms   = การจองห้องประชุม (รวมสรุปประจำวันตอนเช้า)
 *   repairs = การแจ้งซ่อมอุปกรณ์ไอที
 * (ระบบยืมอุปกรณ์ไม่ส่งแจ้งเตือนตั้งแต่ v2.4 จึงไม่มีหัวข้อ)
 */
const ALL_TOPICS = ['rooms', 'repairs'];
/** กลุ่มที่เพิ่งเชิญบอทเข้ามา รับอะไรก่อน — คงพฤติกรรมเดิมคือรับการจองห้อง */
const DEFAULT_TOPICS = ['rooms'];

/**
 * แปลงค่าใน KV เป็นสถานะที่ใช้งานได้ — { topics, left }
 * รองรับทั้งรูปแบบใหม่และของเดิม เพื่อไม่ให้ข้อมูลที่มีอยู่พัง
 *   {"topics":["rooms"],"left":null}  ← รูปแบบปัจจุบัน (หน้าเว็บแอดมินเขียนให้)
 *   "1" / "on" / ค่าว่าง               ← ของเดิม = รับการจองห้อง
 *   "off" / "0"                        ← ไม่รับอะไรเลย
 *   "left:<เวลา>"                      ← บอทไม่ได้อยู่ในกลุ่มแล้ว
 *   "rooms,repairs"                    ← พิมพ์เองใน Dashboard ก็ได้
 */
const parseRecipientValue = (value) => {
  const raw = value === null || value === undefined ? '' : String(value).trim();
  if (raw === '' || raw === '1' || raw.toLowerCase() === 'on') return { topics: [...DEFAULT_TOPICS], left: null };

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      const topics = Array.isArray(parsed.topics) ? parsed.topics.filter(t => ALL_TOPICS.includes(t)) : [];
      return { topics, left: parsed.left || null };
    } catch (e) {
      return { topics: [...DEFAULT_TOPICS], left: null }; // ค่าพัง — ถือว่าเหมือนเดิมไว้ก่อน
    }
  }

  const lower = raw.toLowerCase();
  if (lower.startsWith('left') || lower.startsWith('unreachable')) {
    const marker = raw.slice(raw.indexOf(':') + 1).trim();
    return { topics: [...DEFAULT_TOPICS], left: marker || 'unknown' };
  }
  if (lower === 'off' || lower === '0' || lower === 'false') return { topics: [], left: null };

  const topics = lower.split(',').map(t => t.trim()).filter(t => ALL_TOPICS.includes(t));
  return { topics, left: null };
};

const serializeRecipientValue = ({ topics, left }) =>
  JSON.stringify({ topics: topics.filter(t => ALL_TOPICS.includes(t)), left: left || null });

/**
 * รายชื่อผู้รับแจ้งเตือนทั้งหมดพร้อมสถานะ — [{ id, topics, left, active }]
 * อ่านค่าของทุก key ด้วย (มีไม่กี่ key) เพื่อให้แก้ด้วยมือใน Dashboard แล้วมีผลจริง
 */
async function listRecipients(env) {
  const list = await env.ROOM_BOOKINGS_KV.list({ prefix: RECIPIENT_PREFIX });
  return Promise.all(list.keys.map(async (key) => {
    const id = key.name.slice(RECIPIENT_PREFIX.length);
    const state = parseRecipientValue(await env.ROOM_BOOKINGS_KV.get(key.name));
    return { id, ...state, active: !state.left };
  }));
}

/** บันทึกสถานะของผู้รับหนึ่งราย (รวมหัวข้อที่สมัครไว้) */
async function saveRecipient(env, id, state) {
  await env.ROOM_BOOKINGS_KV.put(`${RECIPIENT_PREFIX}${id}`, serializeRecipientValue(state));
}

/**
 * ID ของกลุ่มที่ต้องได้รับแจ้งเตือนหัวข้อนี้
 * topic = null → ทุกกลุ่มที่ยังรับอะไรอยู่บ้าง (ใช้กับ /status)
 */
async function getRecipientIds(env, topic = null) {
  const recipients = await listRecipients(env);
  if (recipients.length > 0) {
    return recipients
      .filter(r => r.active && (topic ? r.topics.includes(topic) : r.topics.length > 0))
      .map(r => r.id);
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

/**
 * บอทเข้ากลุ่ม — เปิดรับแจ้งเตือน
 * ถ้าเคยตั้งหัวข้อไว้แล้ว (เช่น เคยเลือกรับเฉพาะแจ้งซ่อม) จะคงหัวข้อเดิมไว้
 * ไม่รีเซ็ตกลับเป็นค่าเริ่มต้น เวลาบอทถูกเตะออกแล้วเชิญกลับเข้ามาใหม่
 */
async function addRecipient(env, id) {
  if (!id) return;
  const existing = await env.ROOM_BOOKINGS_KV.get(`${RECIPIENT_PREFIX}${id}`);
  const previous = existing === null ? null : parseRecipientValue(existing);
  const topics = previous && previous.topics.length > 0 ? previous.topics : [...DEFAULT_TOPICS];
  await saveRecipient(env, id, { topics, left: null });
}

/**
 * หยุดส่งแจ้งเตือนให้ปลายทางนี้ — เก็บ key ไว้ แค่เปลี่ยนค่าเป็น left:<เวลา>
 * (ไม่ลบทิ้ง เพราะ Group ID จำยากและมักต้องเอาไปใช้ต่อ เช่น ใส่ใน REPAIR_GROUP_ID)
 */
async function removeRecipient(env, id, reason = 'left') {
  if (!id) return;
  const existing = await env.ROOM_BOOKINGS_KV.get(`${RECIPIENT_PREFIX}${id}`);
  const previous = existing === null ? { topics: [...DEFAULT_TOPICS] } : parseRecipientValue(existing);
  await saveRecipient(env, id, { topics: previous.topics, left: `${reason}:${new Date().toISOString()}` });
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
 * sendNotification(message, env, { topic, recipientIds })
 * ส่งข้อความ Push เข้ากลุ่มที่สมัครรับหัวข้อนั้นไว้ (topic: 'rooms' | 'repairs')
 * ถ้ายังไม่มีกลุ่มไหนสมัครหัวข้อนั้น จะใช้ค่าสำรองใน Worker Settings
 *   rooms → RECIPIENT_ID, repairs → REPAIR_GROUP_ID
 * ใส่ recipientIds มาเองได้ ถ้าต้องการระบุปลายทางตรง ๆ
 *
 * คืนผลสรุปเสมอ { total, sent, failed, errors, removed } — ผู้เรียกจะได้รู้ว่าส่งไม่ถึงใคร
 * (เดิมฟังก์ชันนี้กลืน error ทั้งหมด ทำให้หน้าเว็บขึ้น "ส่งแจ้งเตือนสำเร็จ" ทั้งที่ไม่มีใครได้รับ)
 */
async function sendNotification(message, env, options = {}) {
  const { topic = 'rooms', recipientIds: recipientIdsOverride } = options;
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
      recipientIds = await getRecipientIds(env, topic);
    } catch (e) {
      console.error(`[LINE Push Error] Cannot read recipients: ${e.message}`);
      recipientIds = [];
    }

    // ยังไม่มีกลุ่มไหนสมัครหัวข้อนี้ → ใช้ค่าใน Worker Settings เป็นตัวสำรอง
    // (ทำให้ระบบเดิมที่ตั้ง REPAIR_GROUP_ID / RECIPIENT_ID ไว้ยังทำงานเหมือนเดิม
    //  แต่พอเริ่มติ๊กเลือกกลุ่มในหน้าแอดมินแล้ว รายชื่อในหน้าเว็บจะเป็นตัวตัดสินแทน)
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      const fallback = topic === 'repairs' ? env.REPAIR_GROUP_ID : env.RECIPIENT_ID;
      if (fallback) {
        console.log(`[LINE Push] ไม่มีกลุ่มที่สมัครหัวข้อ "${topic}" — ใช้ค่าสำรองจาก Worker Settings`);
        recipientIds = [fallback];
      } else {
        console.error(`[LINE Push Error] No recipients for topic "${topic}".`);
        const hint = topic === 'repairs'
          ? 'ยังไม่มีกลุ่มไหนติ๊กรับ "แจ้งซ่อม" และไม่ได้ตั้ง REPAIR_GROUP_ID ใน Worker'
          : 'ยังไม่มีกลุ่มไหนติ๊กรับ "จองห้องประชุม" และไม่ได้ตั้ง RECIPIENT_ID ใน Worker';
        return { total: 0, sent: 0, failed: 0, errors: [hint], removed: [] };
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
  //
  //  หน้าที่เดียวของมันคือเติม header CORS ให้ทุกคำตอบที่ handleRequest() คืนมา
  //  รวมถึงตอนโยน error ด้วย — เดิม header ผูกอยู่กับ json() ทำให้เส้นทางที่ตอบ
  //  ด้วย new Response() ตรง ๆ (เช่น /webhook) ไม่มี CORS ติดไปเลย
  // ───────────────────────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {
    const cors = corsHeadersFor(request, env);

    // Preflight CORS request — browser ส่งมาก่อน cross-origin request จริง
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    let response;
    try {
      response = await handleRequest(request, env, ctx);
    } catch (e) {
      console.error(`[Worker Error] ${e.message}\n${e.stack}`);
      response = json({ error: 'Worker internal error' }, 500);
    }

    // Response ที่ handleRequest คืนมาอาจ immutable — ก็อปก่อนแล้วค่อยเติม header
    const withCors = new Response(response.body, response);
    for (const [key, value] of Object.entries(cors)) withCors.headers.set(key, value);
    return withCors;
  },

  // ───────────────────────────────────────────────────────────────────────────
  //  scheduled(event, env, ctx) — ปิดการใช้งานแล้ว (ตามที่ผู้ใช้ระบบขอ)
  //
  //  เดิมส่งสรุปการจองห้องของวันนี้เข้ากลุ่ม LINE ทุกเช้า ตอนนี้เอาออกแล้ว
  //  เพราะดูจากในเว็บ (แท็บ "ตารางการจอง") หรือพิมพ์ @ชื่อบอท จองวันนี้ ในกลุ่มก็ได้
  //
  //  ⚠️ ถ้ายังตั้ง Cron Trigger ค้างไว้ที่ Dashboard → Settings → Triggers
  //     ให้ลบทิ้งด้วย ฟังก์ชันนี้เหลือไว้เฉย ๆ เพื่อไม่ให้ trigger ที่ค้างอยู่ error
  // ───────────────────────────────────────────────────────────────────────────
  async scheduled(event, env, ctx) {
    console.log('[Scheduled] สรุปประจำวันถูกปิดการใช้งานแล้ว — ลบ Cron Trigger ใน Worker Settings ได้เลย');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  handleRequest(request, env, ctx) — เนื้อหาการจัดการ route ทั้งหมด
// ─────────────────────────────────────────────────────────────────────────────
async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── PUBLIC ROUTES (ไม่ต้องการ API Key) ──────────────────────────────────

    // ตรวจสอบสถานะ Worker — หน้า "ตรวจสอบระบบ" ของแอดมินเรียกใช้
    //
    // ⚠️ เดิม endpoint นี้เปิดสาธารณะ ใครก็เปิดดูได้ว่า Worker ตั้งค่าอะไรไว้บ้าง
    //    (ตั้ง CHANNEL_SECRET แล้วหรือยัง / มีกลุ่มรับแจ้งเตือนกี่กลุ่ม) ซึ่งเป็น
    //    ข้อมูลที่ช่วยคนที่จะโจมตีเลือกช่องทางได้ เช่น เห็นว่า channelSecretSet
    //    เป็น false ก็รู้ทันทีว่ายิง /webhook ปลอมเข้ามาได้ — ตอนนี้ต้องเป็นแอดมิน
    if (path === '/status') {
      if (!(await isAdminRequest(request, env))) {
        return json({ error: 'Unauthorized' }, 401);
      }

      // นับผู้รับแจ้งเตือนจริงใน KV ด้วย — ถ้าเป็น 0 แปลว่าแจ้งเตือนจะไม่ถึงใครเลย
      let recipientCount = null;
      try {
        recipientCount = (await getRecipientIds(env)).length;
      } catch (e) {
        console.error(`[Status] Cannot count recipients: ${e.message}`);
      }

      return json({
        lineApiToken: !!env.CHANNEL_ACCESS_TOKEN,
        channelSecretSet: !!env.CHANNEL_SECRET,   // ต้องตั้งค่า ไม่งั้น /webhook ใช้ไม่ได้
        roomKvBinding: !!env.ROOM_BOOKINGS_KV,
        equipmentKvBinding: !!env.EQUIPMENT_BORROWINGS_KV,
        repairKvBinding: !!env.REPAIR_REQUESTS_KV,
        recipientIdSet: !!env.RECIPIENT_ID,
        repairGroupIdSet: !!env.REPAIR_GROUP_ID,
        recipientCount,
      });
    }

    // ล็อกอิน Admin — ตรวจรหัสผ่านกับ ADMIN_PASSWORD แล้วออก "ตั๋วแอดมิน" ให้
    //
    // ⚠️ เดิม endpoint นี้ตอบแค่ { success: true } แล้วหน้าเว็บก็จำเองว่าเป็นแอดมิน
    //    (localStorage.isAdmin = 'true') ซึ่งใครพิมพ์เองใน DevTools ก็ได้ — รหัสผ่าน
    //    จึงไม่ได้กันอะไรเลย ตอนนี้ตอบเป็นตั๋วที่เซ็นด้วย HMAC ฝั่ง Worker
    //    แล้วทุก endpoint ของแอดมินจะตรวจตั๋วใบนั้นจริง ๆ ปลอมเองไม่ได้
    if (path === '/auth/login' && request.method === 'POST') {
      // จำกัดการเดารหัส: 10 ครั้งต่อ IP ต่อ 15 นาที (เดิมเดาได้ไม่จำกัด)
      const clientIp = request.headers.get('CF-Connecting-IP');
      if (!clientIp) {
        // ไม่มี CF-Connecting-IP = ไม่ได้มาผ่านขอบของ Cloudflare ตามปกติ
        // เดิม fallback เป็น 'unknown' ทำให้ทุกคนใช้โควตาเดียวกัน — นับไม่ได้ก็ไม่ให้ผ่าน
        return json({ success: false, error: 'ไม่สามารถระบุที่มาของคำขอได้' }, 400);
      }
      const attemptKey = `login_attempt:${clientIp}`;
      try {
        const attempts = parseInt(await env.ROOM_BOOKINGS_KV.get(attemptKey) || '0', 10);
        if (attempts >= LOGIN_MAX_ATTEMPTS) {
          console.warn(`[Auth] Too many failed logins from ${clientIp}`);
          return json({ success: false, error: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาที' }, 429);
        }

        // นับก่อนตรวจ แล้วค่อยล้างทิ้งเมื่อรหัสถูก
        // (KV อ่านค่าจากแคชที่ขอบได้นานถึง 60 วินาที ถ้านับหลังตรวจ คนที่ยิงพร้อมกัน
        //  หลาย request จะอ่านเลขเดิมทั้งหมดแล้วเดารหัสได้เกินโควตาไปมาก)
        await env.ROOM_BOOKINGS_KV.put(attemptKey, String(attempts + 1), { expirationTtl: LOGIN_WINDOW_SECONDS });

        const { password } = await request.json();

        // เทียบแบบเวลาคงที่ กันการเดารหัสทีละตัวอักษรจากเวลาที่ใช้เปรียบเทียบ
        if (typeof password === 'string' && env.ADMIN_PASSWORD && timingSafeEqual(password, env.ADMIN_PASSWORD)) {
          await env.ROOM_BOOKINGS_KV.delete(attemptKey);

          const issued = await issueAdminToken(env);
          if (!issued) {
            console.error('[Auth] ตั้ง ADMIN_PASSWORD / ADMIN_TOKEN_SECRET ไม่ครบ — ออกตั๋วแอดมินไม่ได้');
            return json({ success: false, error: 'ระบบยังตั้งค่าไม่ครบ' }, 500);
          }
          console.log(`[Auth] Admin login สำเร็จจาก ${clientIp}`);
          return json({ success: true, token: issued.token, expiresAt: issued.expiresAt });
        }

        console.warn(`[Auth] Failed login attempt ${attempts + 1} from ${clientIp}`);
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

        // ── ต้องมีลายเซ็นที่ถูกต้องเสมอ ไม่มีข้อยกเว้น ───────────────────────
        // ⚠️ เดิมถ้าไม่ได้ตั้ง CHANNEL_SECRET ระบบจะ "ข้ามการตรวจลายเซ็น" แล้วรับ
        //    event ต่อไปเลย (fail-open) แปลว่าตอนที่ระบบตั้งค่าไม่ครบ — ซึ่งเป็น
        //    ตอนที่เปราะบางที่สุด — กลับกลายเป็นตอนที่ไม่มีการป้องกันเลย
        //    ใครรู้ URL นี้ก็ยิง {"events":[{"type":"join","source":{"groupId":"C..."}}]}
        //    เพื่อแอบเพิ่มกลุ่มตัวเองเป็นผู้รับแจ้งเตือน แล้วดูดข้อมูลการจอง/แจ้งซ่อม
        //    (ชื่อผู้จอง หัวข้อประชุม เบอร์โทร) ออกไปได้เรื่อย ๆ โดยไม่มีใครรู้
        //    ตอนนี้ถ้าตั้งค่าไม่ครบ = ปฏิเสธทุก event (fail-closed)
        if (!env.CHANNEL_SECRET) {
          console.error('[Webhook] CHANNEL_SECRET ไม่ได้ตั้งค่า — ปฏิเสธ event ทั้งหมด โปรดตั้งค่าใน Worker Settings');
          return new Response('Webhook not configured', { status: 503 });
        }

        const signature = request.headers.get('x-line-signature');
        if (!(await verifyLineSignature(rawBody, signature, env.CHANNEL_SECRET))) {
          console.error('[Webhook] Invalid signature — request rejected.');
          return new Response('Invalid signature', { status: 401 });
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
    //
    // ⚠️ ขอบเขตที่ API Key ทำได้จริง — อ่านให้ครบก่อนใช้เป็นหลักประกันความปลอดภัย
    //    หน้าเว็บนี้เป็น static site ที่ไม่มีระบบล็อกอินผู้ใช้ทั่วไป คีย์จึงถูกฝัง
    //    อยู่ในไฟล์ JS ที่ทุกคนโหลดไปได้ (Vite แทนค่า VITE_API_SECRET_KEY ตอน build)
    //    ใครเปิด DevTools ก็ก็อปคีย์ไปยิง API เองได้ — คีย์นี้ "กันคนเดินผ่าน"
    //    ไม่ใช่ "กันคนตั้งใจ" ของจริงที่กันได้คือ:
    //      1. CORS allowlist ด้านบน  → เว็บอื่นเรียกแทนผู้ใช้ในเบราว์เซอร์ไม่ได้
    //      2. X-Admin-Token ด้านล่าง → งานของแอดมินต้องมีตั๋วที่ Worker เซ็นเท่านั้น
    //    ถ้าวันหนึ่งต้องกันการอ่านข้อมูลด้วย ต้องมีระบบล็อกอินผู้ใช้จริง (ดู
    //    หัวข้อ "ข้อจำกัดด้านความปลอดภัย" ใน DEVELOPER_GUIDE.md)
    const apiKey = request.headers.get('X-API-Key');
    if (!env.API_SECRET_KEY || !timingSafeEqual(apiKey || '', env.API_SECRET_KEY)) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // ตั๋วแอดมิน — คำนวณครั้งเดียวแล้วใช้ซ้ำในทุก route ด้านล่าง
    const isAdmin = await isAdminRequest(request, env);

    /** ปฏิเสธเมื่อไม่ใช่แอดมิน — ใช้กับงานที่มีแต่เจ้าหน้าที่เท่านั้นที่ทำได้ */
    const requireAdmin = () =>
      isAdmin ? null : json({ error: 'ต้องเข้าสู่โหมดเจ้าหน้าที่ก่อน' }, 403);

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

          // ── ตรวจรูปร่างข้อมูลก่อนเขียนลง KV ────────────────────────────────
          // เดิมรับ array อะไรก็ได้ ทำให้ยัดของขยะ/ของใหญ่เกินจริงเข้ามาถมพื้นที่ KV
          // หรือใส่ค่าแปลก ๆ ที่หน้าเว็บเอาไปแสดงต่อได้
          if (incoming.length > MAX_RECORDS_PER_TYPE) {
            console.error(`[Data Guard] "${type}" payload มี ${incoming.length} รายการ เกินลิมิต`);
            return json({ error: `บันทึกได้ไม่เกิน ${MAX_RECORDS_PER_TYPE} รายการ` }, 413);
          }
          if (!incoming.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string' && item.id !== '')) {
            console.error(`[Data Guard] "${type}" มีรายการที่ไม่มี id เป็นสตริง`);
            return json({ error: 'ทุกรายการต้องเป็น object และมี id เป็นข้อความ' }, 400);
          }

          const serialized = JSON.stringify(incoming);
          if (serialized.length > MAX_PAYLOAD_BYTES) {
            console.error(`[Data Guard] "${type}" payload ${serialized.length} bytes เกินลิมิต`);
            return json({ error: 'ข้อมูลใหญ่เกินกำหนด' }, 413);
          }

          // ลิงก์ไฟล์แนบต้องเป็น http/https เท่านั้น — กัน javascript: ที่กลายเป็น XSS
          // เมื่อหน้าเว็บเอาไปใส่ใน <a href> แล้วมีคนกดเปิด (ดู safeHref ฝั่งหน้าเว็บ)
          for (const item of incoming) {
            if ('attachmentUrl' in item) item.attachmentUrl = sanitizeUrl(item.attachmentUrl);
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

          // ── กันการลบข้อมูลยกชุด ─────────────────────────────────────────────
          // endpoint นี้เขียนทับทั้ง array เสมอ การส่ง [] เข้ามาครั้งเดียว
          // จึงลบข้อมูลทั้งระบบได้ในคำขอเดียว
          // ในหน้าเว็บ ผู้ใช้ทั่วไปทำได้แค่ "เพิ่ม/แก้/ยกเลิก" รายการของตัวเอง
          // (ยกเลิก = เปลี่ยนสถานะ ไม่ได้ลบทิ้ง) การลบจริงเป็นสิทธิ์ของแอดมินเท่านั้น
          // ดังนั้นถ้ารายการหายไปเกินครึ่ง แต่คนส่งไม่มีตั๋วแอดมิน = ปฏิเสธไปเลย
          // เดิมแค่เขียน log เตือนไว้แล้วเขียนทับให้ตามปกติ
          if (previous) {
            try {
              const previousCount = JSON.parse(previous).length;
              const shrankSharply = previousCount >= BULK_DELETE_MIN_RECORDS && incoming.length < previousCount / 2;

              if (shrankSharply && !isAdmin) {
                console.error(`[Data Guard] ปฏิเสธการลบยกชุด "${type}": ${previousCount} → ${incoming.length} รายการ (ไม่มีตั๋วแอดมิน)`);
                return json({
                  error: 'การลบข้อมูลจำนวนมากต้องเข้าสู่โหมดเจ้าหน้าที่ก่อน กรุณารีเฟรชหน้าแล้วลองใหม่',
                }, 403);
              }
              if (shrankSharply) {
                console.warn(`[Data Guard] "${type}" shrank ${previousCount} → ${incoming.length} รายการ โดยแอดมิน (สำเนาเดิมอยู่ที่ ${type}_data_prev)`);
              }
            } catch (e) { /* ของเดิมพัง ข้ามการเทียบไป */ }

            await KV.put(`${type}_data_prev`, previous);
            await KV.put(`${type}_data_prev_at`, new Date().toISOString());
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
        let notifyBody;
        try {
          notifyBody = await request.json();
        } catch (e) {
          return json({ success: false, error: 'Body ไม่ใช่ JSON ที่ถูกต้อง' }, 400);
        }
        const { message, target } = notifyBody;

        if (typeof message !== 'string' || message.trim() === '') {
          return json({ success: false, error: 'ไม่มีข้อความที่จะส่ง' }, 400);
        }

        // ── กันเอาบอทไปสแปม/หลอกลวงในกลุ่ม LINE ────────────────────────────
        // endpoint นี้ต้องเปิดให้ผู้ใช้ทั่วไปเรียกได้ เพราะแจ้งเตือนถูกส่งตอนที่
        // มีคนจองห้อง/แจ้งซ่อม (ซึ่งไม่ต้องล็อกอิน) แต่ข้อความเป็นอะไรก็ได้
        // ใครถอด API Key จากไฟล์ JS ไปแล้วก็ยิงข้อความหลอกลวงเข้าทุกกลุ่มได้
        // จำกัดทั้งความยาวและความถี่ไว้ เพื่อให้ความเสียหายอยู่ในวงจำกัด
        if (message.length > MAX_NOTIFY_LENGTH) {
          return json({ success: false, error: 'ข้อความยาวเกินกำหนด' }, 413);
        }

        // แอดมินไม่ติดลิมิต (ต้องกดส่งซ้ำให้กลุ่มได้เวลาแจ้งเตือนพลาด)
        if (!isAdmin) {
          // ต่างจาก /auth/login ตรงที่ไม่มี IP แล้ว "ไม่ปฏิเสธ" แต่ให้ไปรวมถังเดียวกัน
          // เพราะ endpoint นี้อยู่บนเส้นทางที่ผู้ใช้จองห้องจริง ๆ การบล็อกทิ้ง
          // แปลว่าเจ้าหน้าที่ไม่ได้รับแจ้งเตือนการจอง ซึ่งเสียหายกว่าการโดนสแปม
          const notifyIp = request.headers.get('CF-Connecting-IP') || 'unknown';
          const notifyKey = `notify_count:${notifyIp}`;
          const notifyCount = parseInt(await env.ROOM_BOOKINGS_KV.get(notifyKey) || '0', 10);
          if (notifyCount >= NOTIFY_MAX_PER_WINDOW) {
            console.warn(`[Notify] Rate limit hit จาก ${notifyIp}`);
            return json({ success: false, error: 'ส่งแจ้งเตือนบ่อยเกินไป กรุณารอสักครู่' }, 429);
          }
          await env.ROOM_BOOKINGS_KV.put(notifyKey, String(notifyCount + 1), { expirationTtl: NOTIFY_WINDOW_SECONDS });
        }

        // target = "repair" → หัวข้อ repairs, ไม่ระบุ → หัวข้อ rooms
        // กลุ่มไหนได้รับบ้างขึ้นกับที่ติ๊กไว้ในหน้าแอดมิน (ดู sendNotification)
        const topic = target === 'repair' ? 'repairs' : 'rooms';

        // รอผลจาก LINE จริง ๆ ก่อนตอบกลับ (เดิมใช้ ctx.waitUntil แล้วตอบ success ทันที
        // หน้าเว็บจึงขึ้นว่า "ส่งสำเร็จ" แม้ push จะล้มเหลวทุกปลายทาง เช่น token หมดอายุ
        // หรือโควตาข้อความรายเดือนเต็ม) — ปกติใช้เวลาไม่ถึงวินาที
        const result = await sendNotification(message, env, { topic });

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
      // ⚠️ ทั้ง 3 เมธอดของ /recipients เป็นงานของแอดมินล้วน — เดิมกันด้วย API Key
      //    อย่างเดียว ซึ่งเป็นคีย์สาธารณะ ใครก็ดูได้ว่าแจ้งเตือนวิ่งเข้ากลุ่มไหน
      //    และ "ย้าย" ปลายทางแจ้งเตือนไปกลุ่มตัวเองได้ด้วย POST /recipients
      if (path === '/recipients' && request.method === 'GET') {
        const denied = requireAdmin();
        if (denied) return denied;

        // รวมกลุ่มที่หยุดรับแจ้งเตือนแล้วมาด้วย (active: false) เพื่อให้ยังเห็น Group ID
        // เอาไปก็อปใช้ต่อได้ เช่น ใส่ใน REPAIR_GROUP_ID หรือเปิดรับใหม่ภายหลัง
        let stored = await listRecipients(env);
        if (stored.length === 0) {
          await getRecipientIds(env);          // เผื่อยังต้อง migrate ของเก่า
          stored = await listRecipients(env);
        }

        // กลุ่มที่ตั้งไว้ใน REPAIR_GROUP_ID แต่ยังไม่มีใน KV — สร้างให้อัตโนมัติ
        // จะได้โผล่ในหน้าแอดมินให้ติ๊กเลือกหัวข้อได้เหมือนกลุ่มอื่น ไม่ต้องไปแก้ env
        if (env.REPAIR_GROUP_ID && !stored.some(r => r.id === env.REPAIR_GROUP_ID)) {
          await saveRecipient(env, env.REPAIR_GROUP_ID, { topics: ['repairs'], left: null });
          console.log(`[Recipients] เพิ่ม ${env.REPAIR_GROUP_ID} จาก REPAIR_GROUP_ID เข้ารายการให้จัดการในหน้าเว็บ`);
          stored = await listRecipients(env);
        }

        const recipients = await Promise.all(stored.map(async ({ id, active, topics }) => {
          const isGroup = id.startsWith('C');
          const summaryUrl = isGroup
            ? `https://api.line.me/v2/bot/group/${id}/summary`
            : `https://api.line.me/v2/bot/profile/${id}`;
          const base = { id, type: isGroup ? 'group' : 'user', active, topics };
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

      // ── POST /recipients — ตั้งว่ากลุ่มนี้รับแจ้งเตือนหัวข้ออะไรบ้าง ──────
      // Body: { id: "C...", topics: ["rooms", "repairs"] }  (ส่ง [] = ไม่รับอะไรเลย)
      // เรียกจากหน้าตรวจสอบระบบของแอดมิน (ติ๊ก/เอาติ๊กออกหน้ากลุ่ม)
      if (path === '/recipients' && request.method === 'POST') {
        const denied = requireAdmin();
        if (denied) return denied;

        let body;
        try {
          body = await request.json();
        } catch (e) {
          return json({ error: 'Body ไม่ใช่ JSON ที่ถูกต้อง' }, 400);
        }

        const { id, topics } = body;
        if (typeof id !== 'string' || id.trim() === '') {
          return json({ error: 'ต้องระบุ id ของกลุ่ม' }, 400);
        }
        if (!Array.isArray(topics) || topics.some(t => !ALL_TOPICS.includes(t))) {
          return json({ error: `topics ต้องเป็น array ของ ${ALL_TOPICS.join(' / ')}` }, 400);
        }

        const existing = await env.ROOM_BOOKINGS_KV.get(`${RECIPIENT_PREFIX}${id}`);
        const previous = existing === null ? { left: null } : parseRecipientValue(existing);
        await saveRecipient(env, id, { topics, left: previous.left });   // คงสถานะ "บอทออกจากกลุ่ม" ไว้
        console.log(`[Recipients] ${id} → [${topics.join(', ') || 'ไม่รับอะไรเลย'}]`);

        return json({ success: true, id, topics, active: !previous.left });
      }

      // ── DELETE /recipients?id=C... — เอากลุ่มออกจากรายการถาวร ──────────────
      // ใช้กับกลุ่มที่บอทไม่ได้อยู่แล้ว/กลุ่มที่ยุบไปแล้ว เพื่อไม่ให้รกรายการ
      // (ปกติแค่เอาติ๊กออกก็พอ — การลบทำให้ Group ID หายไปด้วย)
      if (path === '/recipients' && request.method === 'DELETE') {
        const denied = requireAdmin();
        if (denied) return denied;

        const id = url.searchParams.get('id');
        if (!id) return json({ error: 'ต้องระบุ id ของกลุ่ม' }, 400);

        await env.ROOM_BOOKINGS_KV.delete(`${RECIPIENT_PREFIX}${id}`);
        console.log(`[Recipients] ลบ ${id} ออกจากรายการแล้ว`);

        // กลุ่มที่ตั้งไว้ใน REPAIR_GROUP_ID จะถูกดึงกลับเข้ามาใหม่ตอนเปิดหน้ารายการ
        // ต้องบอกให้รู้ ไม่งั้นจะงงว่าลบแล้วทำไมกลับมาอีก
        const warning = id === env.REPAIR_GROUP_ID
          ? 'กลุ่มนี้ตั้งไว้ใน REPAIR_GROUP_ID ของ Worker ระบบจะดึงกลับเข้ารายการอีกครั้ง — ถ้าจะลบถาวรต้องลบตัวแปรนั้นด้วย'
          : undefined;

        return json({ success: true, id, warning });
      }

      return json({ error: 'Route not found' }, 404);

    } catch (e) {
      // ข้อความ error จริงเก็บไว้ใน log ของ Worker เท่านั้น
      // ไม่ส่งกลับหน้าเว็บ เพราะอาจมีชื่อ binding/โครงสร้างภายในติดไปด้วย
      console.error(`[Worker Error] ${e.message}\n${e.stack}`);
      return json({ error: 'Worker internal error' }, 500);
    }
}
