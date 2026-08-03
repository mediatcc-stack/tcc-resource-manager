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
 *    หรือเพิ่มด้วยตัวเองได้ที่ KV → สร้าง key ใหม่ชื่อ "recipient:<Group ID>" ค่าอะไรก็ได้ เช่น "1"
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
 *  │  CHANNEL_SECRET          │  LINE Channel Secret (verify Webhook)         │
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
 *    POST /data?type=rooms      → บันทึกข้อมูลการจองห้องทั้งหมด (overwrite)
 *    GET  /data?type=equipment  → ดึงข้อมูลการยืมอุปกรณ์ทั้งหมด
 *    POST /data?type=equipment  → บันทึกข้อมูลการยืมอุปกรณ์ทั้งหมด (overwrite)
 *    GET  /data?type=repairs    → ดึงข้อมูลการแจ้งซ่อมอุปกรณ์ไอทีทั้งหมด
 *    POST /data?type=repairs    → บันทึกข้อมูลการแจ้งซ่อมอุปกรณ์ไอทีทั้งหมด (overwrite)
 *    POST /notify               → Body: { message, target? } → ส่ง LINE แจ้งเตือน
 *                                  target: "repair" → ส่งเข้าเฉพาะกลุ่ม REPAIR_GROUP_ID
 *                                  ไม่ระบุ → ส่งเข้า recipient ทั่วไปทุกคน (จองห้อง)
 *    GET  /recipients           → ดูรายชื่อ LINE User ID ที่รับแจ้งเตือน
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *  🛠️  แก้ไขล่าสุด
 * ═══════════════════════════════════════════════════════════════════════════════
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
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-API-Key',
};

// ─────────────────────────────────────────────────────────────────────────────
//  ระบบเก็บรายชื่อผู้รับแจ้งเตือน — 1 key ต่อ 1 ผู้รับ (recipient:<id>)
// ─────────────────────────────────────────────────────────────────────────────
//  เดิมเก็บเป็น array ก้อนเดียวใน key "recipient_ids" ซึ่งต้องอ่านทั้งก้อน
//  มาแก้ไขแล้วเขียนทับทั้งก้อนกลับไปทุกครั้ง (read-modify-write) — ถ้ามีหลาย
//  webhook event (เช่น 2 กลุ่ม join ไล่เลี่ยกัน) เข้ามาพร้อมกัน คำเขียนที่มาทีหลัง
//  จะเขียนทับคำเขียนก่อนหน้าทั้งหมด ทำให้ ID ที่เพิ่งเพิ่มไปหายเงียบๆ โดยไม่มี error
//
//  ตอนนี้เปลี่ยนมาเก็บทีละ key แยกกัน (recipient:<id> = "1") แต่ละ webhook event
//  จะเขียนแค่ key ของตัวเอง ไม่มีทางไปทับ ID อื่นได้อีก ไม่ว่าจะมีกี่ event
//  เข้ามาพร้อมกันก็ตาม — ใช้ namespace เดิม (ROOM_BOOKINGS_KV) ไม่ต้องเพิ่ม
//  binding ใหม่ใน Cloudflare
//
//  getRecipientIds() จะ migrate ข้อมูลเก่าใน "recipient_ids" มาเป็น key แยก
//  ให้อัตโนมัติครั้งแรกที่เรียก (ถ้ายังไม่เคย migrate) — ไม่ต้องเพิ่มเพื่อนบอทใหม่
// ─────────────────────────────────────────────────────────────────────────────
const RECIPIENT_PREFIX = 'recipient:';

async function getRecipientIds(env) {
  const list = await env.ROOM_BOOKINGS_KV.list({ prefix: RECIPIENT_PREFIX });
  if (list.keys.length > 0) {
    return list.keys.map(k => k.name.slice(RECIPIENT_PREFIX.length));
  }

  // ยังไม่เคย migrate — ลองอ่านของเก่า (recipient_ids array) มาย้ายเป็น key แยกให้ครั้งเดียว
  const legacyIds = await env.ROOM_BOOKINGS_KV.get('recipient_ids', 'json') || [];
  if (Array.isArray(legacyIds) && legacyIds.length > 0) {
    await Promise.all(legacyIds.map(id => env.ROOM_BOOKINGS_KV.put(`${RECIPIENT_PREFIX}${id}`, '1')));
    console.log(`[Migration] Migrated ${legacyIds.length} recipient(s) from legacy "recipient_ids" to per-key storage`);
    return legacyIds;
  }

  return [];
}

async function addRecipient(env, id) {
  if (!id) return;
  await env.ROOM_BOOKINGS_KV.put(`${RECIPIENT_PREFIX}${id}`, '1');
}

async function removeRecipient(env, id) {
  if (!id) return;
  await env.ROOM_BOOKINGS_KV.delete(`${RECIPIENT_PREFIX}${id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  sendNotification(message, env, recipientIdsOverride?)
//  ส่งข้อความ Push ไปหา LINE ของเจ้าหน้าที่ทุกคนใน recipient_ids
//  ถ้า recipient_ids ใน KV ว่าง จะใช้ RECIPIENT_ID จาก env เป็น fallback
//  ถ้าใส่ recipientIdsOverride มา จะส่งเฉพาะรายชื่อนั้น ไม่ไปดึงจาก KV/env เลย
//  (ใช้กับ /notify?target=repair เพื่อส่งแจ้งซ่อมเข้าเฉพาะกลุ่มที่กำหนด)
// ─────────────────────────────────────────────────────────────────────────────
async function sendNotification(message, env, recipientIdsOverride) {
  let recipientIds = recipientIdsOverride;

  if (!recipientIds) {
    try {
      recipientIds = await getRecipientIds(env);
    } catch (e) {
      recipientIds = [];
    }

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      if (env.RECIPIENT_ID) {
        recipientIds = [env.RECIPIENT_ID];
      } else {
        console.error("[LINE Push Error] No recipients found.");
        return;
      }
    }
  }

  const pushPromises = recipientIds.map(recipientId =>
    fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: recipientId, messages: [{ type: 'text', text: message }] }),
    })
    .then(async response => {
      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[LINE Push Error] Failed to ID: ${recipientId}, Status: ${response.status}, Body: ${errorBody}`);
      }
    })
    .catch(error => {
      console.error(`[LINE Push Error] ID: ${recipientId}, Error: ${error.message}`);
    })
  );

  await Promise.all(pushPromises);
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
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
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
      const status = {
        lineApiToken: !!env.CHANNEL_ACCESS_TOKEN,
        roomKvBinding: !!env.ROOM_BOOKINGS_KV,
        equipmentKvBinding: !!env.EQUIPMENT_BORROWINGS_KV,
        repairKvBinding: !!env.REPAIR_REQUESTS_KV,
        recipientIdSet: !!env.RECIPIENT_ID,
        repairGroupIdSet: !!env.REPAIR_GROUP_ID,
      };
      return new Response(JSON.stringify(status), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ล็อกอิน Admin — ตรวจสอบรหัสผ่านกับ ADMIN_PASSWORD ใน env
    if (path === '/auth/login' && request.method === 'POST') {
      try {
        const { password } = await request.json();
        if (password && password === env.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ success: false }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Webhook จาก LINE — เพิ่ม groupId ลง recipient อัตโนมัติเมื่อบอทถูกเชิญเข้ากลุ่ม
    // (เก็บเฉพาะกลุ่มเท่านั้น ไม่เก็บ User ID ส่วนตัวที่แอดเพื่อนบอทเดี่ยวๆ)
    // LINE เรียก endpoint นี้เอง ไม่ต้องมี API Key
    // ต้องตั้งค่า Webhook URL ที่ LINE Console:
    //   https://tcc-line-notifier.media-tcc.workers.dev/webhook
    if (path === '/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
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
              await removeRecipient(env, removeId);
              console.log(`[Webhook] Removed recipient: ${removeId} (bot left group)`);
            }
          }

          // ── @Mention Handler ──────────────────────────────────────────────
          // ทริกเกอร์เฉพาะเมื่อมีคน @Bot ในกลุ่มเท่านั้น
          // ใช้ Reply Token → ไม่กิน Push quota เลย
          if (event.type === 'message' && event.message?.type === 'text') {
            const isBotMentioned = event.message.mention?.mentionees?.some(m => m.isSelf === true);

            if (isBotMentioned) {
              const text = event.message.text.toLowerCase();

              // คำสั่ง: @Bot ยืม / รายงานยืม → รายงานอุปกรณ์ที่ยังไม่คืน (เผื่อ Push token หมด เรียกดูเองได้)
              if (text.includes('ยืม')) {
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

                await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
                  },
                  body: JSON.stringify({
                    replyToken: event.replyToken,
                    messages: [{ type: 'text', text: replyText }],
                  }),
                });

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

                await fetch('https://api.line.me/v2/bot/message/reply', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
                  },
                  body: JSON.stringify({
                    replyToken: event.replyToken,
                    messages: [{ type: 'text', text: replyText }],
                  }),
                });

                console.log(`[Mention] Repair report sent (${activeRepairs.length}/${allActiveRepairs.length} repairs)`);

              // คำสั่ง: @Bot รายงาน / จอง / จองพรุ่งนี้ / จอง 16-6-69 / จอง 20 ก.ค. 69
              } else if (text.includes('รายงาน') || text.includes('จอง')) {

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

                  await fetch('https://api.line.me/v2/bot/message/reply', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
                    },
                    body: JSON.stringify({
                      replyToken: event.replyToken,
                      messages: [{ type: 'text', text: replyText }],
                    }),
                  });

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

                  await fetch('https://api.line.me/v2/bot/message/reply', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
                    },
                    body: JSON.stringify({
                      replyToken: event.replyToken,
                      messages: [{ type: 'text', text: replyText }],
                    }),
                  });

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

                  await fetch('https://api.line.me/v2/bot/message/reply', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${env.CHANNEL_ACCESS_TOKEN}`,
                    },
                    body: JSON.stringify({
                      replyToken: event.replyToken,
                      messages: [{ type: 'text', text: replyText }],
                    }),
                  });

                  console.log(`[Mention] Replied with ${dayBookings.length} bookings for ${targetISO}`);
                }
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
          return new Response(JSON.stringify({ error: `Unknown data type: ${type}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const KV = env[KV_NAME];
        const kvError = checkKvBinding(KV, KV_NAME); // เก็บ error ไว้ตัวแปรก่อน (ไม่เรียกซ้ำ)
        if (kvError) return kvError;

        if (request.method === 'GET') {
          const data = await KV.get(`${type}_data`, 'json') || [];
          return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (request.method === 'POST') {
          await KV.put(`${type}_data`, JSON.stringify(await request.json()));
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ── /notify — ส่ง LINE Push Message ──────────────────────────────────
      // Frontend ส่ง { message: "ข้อความ", target?: "repair" } มา แล้ว Worker ส่งต่อให้ LINE
      // target: "repair" → ส่งเข้าเฉพาะกลุ่ม REPAIR_GROUP_ID เท่านั้น (ไม่ส่งเข้า recipient ทั่วไป)
      // ไม่ระบุ target → ส่งเข้าทุก recipient ตามปกติ (ใช้กับระบบจองห้อง)
      // ใช้ ctx.waitUntil เพื่อไม่ให้ response รอ LINE ตอบกลับ (non-blocking)
      if (path === '/notify' && request.method === 'POST') {
        const { message, target } = await request.json();

        if (target === 'repair') {
          if (!env.REPAIR_GROUP_ID) {
            console.error('[LINE Push Error] REPAIR_GROUP_ID not configured — skipped repair notification.');
          } else {
            ctx.waitUntil(sendNotification(message, env, [env.REPAIR_GROUP_ID]));
          }
        } else {
          ctx.waitUntil(sendNotification(message, env));
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ── /recipients — ดูรายชื่อ LINE User ID ที่รับแจ้งเตือน ────────────
      if (path === '/recipients' && request.method === 'GET') {
        const recipientIds = await getRecipientIds(env);
        return new Response(JSON.stringify(recipientIds), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Route not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (e) {
      console.error(`[Worker Error] ${e.message}\n${e.stack}`);
      return new Response(JSON.stringify({ error: 'Worker internal error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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
    const today = new Date().toISOString().split('T')[0];
    const bookings = await env.ROOM_BOOKINGS_KV.get('rooms_data', 'json') || [];
    const todayBookings = bookings
      .filter(b => b.date === today && b.status === 'จองแล้ว')
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    if (todayBookings.length > 0) {
      let reportMsg = `📊 สรุปการจองห้องประชุม (วันนี้)\n---------------------\n`;
      todayBookings.forEach(b => {
        reportMsg += `📅 ${b.roomName} (${b.startTime}-${b.endTime})\n   - ${b.purpose} (โดย ${b.bookerName})\n\n`;
      });
      reportMsg += `🔗 ตรวจสอบเพิ่มเติมในระบบ`;
      await sendNotification(reportMsg, env);
    }
  }
};
